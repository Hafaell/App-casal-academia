-- =====================================================================
-- Treino a Dois: leva 3 das funções do casal.
--
-- 7. Limite mensal de exceções: cada pessoa marca no máximo N exceções por mês (pelo mês
--    do dia justificado). N é regra do grupo (padrão 4). Recusada não conta, porque some.
--    O limite é conferido ao marcar; close_week e o placar continuam contando as exceções
--    que existem, então os dois seguem iguais.
-- 9. Desafios do mês: um desafio por mês para o grupo (ex.: 8 treinos de cardio somados).
--    Não mexe em meta nem multa. Cumprido, dá um giro extra na roleta de prêmios.
-- 11. Fotos de evolução: área privada. Cada foto só aparece para quem tirou, a não ser
--    que a pessoa escolha mostrar ao grupo. Bucket próprio, privado: evolution/<user_id>/<arquivo>.jpg
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7. Limite mensal de exceções
-- ---------------------------------------------------------------------

alter table public.groups
  add column if not exists exceptions_per_month int not null default 4 check (exceptions_per_month between 1 and 20);

grant update (exceptions_per_month) on public.groups to authenticated;

-- Mesmo gatilho da leva 2, mais o limite do mês.
create or replace function public.exceptions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := public.local_today(new.group_id);
  lim int;
  used int;
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  new.reviewed_by := null;
  new.reviewed_at := null;

  if extract(isodow from new.day) > 5 then
    raise exception 'Exceções valem só de segunda a sexta (sábado é opcional e domingo é folga)';
  end if;
  if new.day < public.monday_of(today) then
    raise exception 'Só dá para marcar exceção na semana atual ou em semanas futuras';
  end if;
  if new.day > today + 60 then
    raise exception 'Exceção muito distante: marque no máximo 60 dias à frente';
  end if;
  if public.week_is_closed(new.group_id, new.day) then
    raise exception 'Essa semana já foi fechada';
  end if;
  if exists (select 1 from public.checkins c
             where c.group_id = new.group_id and c.user_id = new.user_id and c.day = new.day) then
    raise exception 'Você já treinou nesse dia';
  end if;
  if exists (select 1 from public.exception_rejections r
             where r.group_id = new.group_id and r.author_id = new.user_id and r.day = new.day) then
    raise exception 'O seu parceiro recusou a exceção desse dia. Não dá para marcar de novo' using errcode = 'P0001';
  end if;

  -- Duas exceções da mesma pessoa ao mesmo tempo esperam uma pela outra antes de contar.
  perform pg_advisory_xact_lock(hashtext(new.group_id::text || new.user_id::text));
  select exceptions_per_month into lim from public.groups where id = new.group_id;
  select count(*) into used
  from public.exceptions e
  where e.group_id = new.group_id and e.user_id = new.user_id
    and date_trunc('month', e.day) = date_trunc('month', new.day);
  if used >= lim then
    raise exception 'Você já usou as % exceções deste mês', lim using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Desafios do mês
-- ---------------------------------------------------------------------

create table if not exists public.monthly_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Primeiro dia do mês do desafio.
  month date not null check (extract(day from month) = 1),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  -- total: treinos somados do grupo; musculacao/cardio/aula: só desse tipo; juntos: dias de treino a dois.
  kind text not null check (kind in ('total', 'musculacao', 'cardio', 'aula', 'juntos')),
  target int not null check (target between 1 and 200),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint one_challenge_per_month unique (group_id, month)
);

create or replace function public.monthly_challenges_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  this_month date := date_trunc('month', public.local_today(new.group_id))::date;
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  if new.month not in (this_month, (this_month + interval '1 month')::date) then
    raise exception 'Dá para criar desafio só para este mês ou para o próximo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists monthly_challenges_before_insert on public.monthly_challenges;
create trigger monthly_challenges_before_insert
  before insert on public.monthly_challenges
  for each row execute function public.monthly_challenges_before_insert();

alter table public.monthly_challenges enable row level security;

drop policy if exists monthly_challenges_select on public.monthly_challenges;
drop policy if exists monthly_challenges_insert on public.monthly_challenges;
drop policy if exists monthly_challenges_update on public.monthly_challenges;
drop policy if exists monthly_challenges_delete on public.monthly_challenges;
create policy monthly_challenges_select on public.monthly_challenges for select to authenticated using (public.is_member(group_id));
create policy monthly_challenges_insert on public.monthly_challenges for insert to authenticated with check (public.is_member(group_id));
create policy monthly_challenges_update on public.monthly_challenges for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy monthly_challenges_delete on public.monthly_challenges for delete to authenticated using (public.is_member(group_id));

revoke all on public.monthly_challenges from anon;
revoke insert, update on public.monthly_challenges from authenticated;
grant insert (group_id, month, title, kind, target) on public.monthly_challenges to authenticated;
grant update (title, kind, target) on public.monthly_challenges to authenticated;

-- Quanto do desafio já foi feito. Mesma conta de src/domain/challenges.ts (challengeProgress),
-- e "juntos" com a mesma regra de src/domain/together.ts: mesmo dia, até 200 m e até 3 horas.
create or replace function public.challenge_progress(p_challenge uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ch public.monthly_challenges;
  done int;
begin
  select * into ch from public.monthly_challenges where id = p_challenge;
  -- Quem é de fora do grupo não descobre nada.
  if not found or not public.is_member(ch.group_id) then
    return 0;
  end if;

  if ch.kind = 'juntos' then
    select count(distinct a.day) into done
    from public.checkins a
    join public.checkins b
      on b.group_id = a.group_id and b.day = a.day and b.user_id <> a.user_id
    where a.group_id = ch.group_id
      and a.day >= ch.month and a.day < (ch.month + interval '1 month')::date
      and a.lat is not null and b.lat is not null
      and abs(extract(epoch from (a.created_at - b.created_at))) <= 3 * 3600
      and public.distance_m(a.lat, a.lng, b.lat, b.lng) <= 200;
  else
    select count(*) into done
    from public.checkins c
    where c.group_id = ch.group_id
      and c.day >= ch.month and c.day < (ch.month + interval '1 month')::date
      and (ch.kind = 'total' or c.kind = ch.kind);
  end if;

  return done;
end;
$$;

revoke execute on function public.challenge_progress(uuid) from public, anon;
grant execute on function public.challenge_progress(uuid) to authenticated;

-- Giro extra da roleta de prêmios para o desafio cumprido.
alter table public.reward_spins alter column week_start drop not null;
alter table public.reward_spins
  add column if not exists challenge_id uuid unique references public.monthly_challenges (id) on delete cascade;

create or replace function public.spin_challenge_reward(p_challenge uuid)
returns public.reward_spins
language plpgsql
security definer
set search_path = public
as $$
declare
  ch public.monthly_challenges;
  r public.rewards;
  spin public.reward_spins;
begin
  select * into ch from public.monthly_challenges where id = p_challenge;
  if not found or auth.uid() is null or not public.is_member(ch.group_id) then
    raise exception 'Desafio não encontrado';
  end if;

  if public.challenge_progress(ch.id) < ch.target then
    raise exception 'O desafio ainda não foi cumprido' using errcode = 'P0001';
  end if;

  select * into r from public.rewards where group_id = ch.group_id and active order by random() limit 1;
  if not found then
    raise exception 'Cadastre pelo menos um prêmio ativo antes de girar' using errcode = 'P0001';
  end if;

  insert into public.reward_spins (group_id, challenge_id, reward_id, reward_text, spun_by)
  values (ch.group_id, ch.id, r.id, r.description, auth.uid())
  on conflict (challenge_id) do nothing
  returning * into spin;
  if spin.id is null then
    raise exception 'O giro deste desafio já foi usado' using errcode = 'P0001';
  end if;
  return spin;
end;
$$;

-- Depois do giro, o desafio fica travado: apagar e recriar (ou mudar) daria outro giro.
create or replace function public.monthly_challenges_lock_after_spin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apagar o grupo inteiro (exclusão em cascata, dentro de outro gatilho) continua valendo.
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if exists (select 1 from public.reward_spins s where s.challenge_id = old.id) then
    raise exception 'Esse desafio já deu o giro de prêmio e não pode mais ser mudado' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists monthly_challenges_lock_after_spin on public.monthly_challenges;
create trigger monthly_challenges_lock_after_spin
  before update or delete on public.monthly_challenges
  for each row execute function public.monthly_challenges_lock_after_spin();

revoke execute on function public.spin_challenge_reward(uuid) from public, anon;
grant execute on function public.spin_challenge_reward(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Fotos de evolução
-- ---------------------------------------------------------------------

create table if not exists public.evolution_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Grupo com quem a pessoa pode escolher compartilhar a foto.
  group_id uuid not null references public.groups (id) on delete cascade,
  photo_path text not null unique,
  taken_on date not null,
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 20 and 400),
  note text check (note is null or char_length(note) <= 200),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists evolution_photos_user_idx on public.evolution_photos (user_id, taken_on);

create or replace function public.evolution_photos_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  if split_part(new.photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'Caminho da foto inválido';
  end if;
  if new.taken_on > public.local_today(new.group_id) then
    raise exception 'A data da foto não pode ser no futuro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists evolution_photos_before_insert on public.evolution_photos;
create trigger evolution_photos_before_insert
  before insert on public.evolution_photos
  for each row execute function public.evolution_photos_before_insert();

alter table public.evolution_photos enable row level security;

drop policy if exists evolution_photos_select on public.evolution_photos;
drop policy if exists evolution_photos_insert on public.evolution_photos;
drop policy if exists evolution_photos_update on public.evolution_photos;
drop policy if exists evolution_photos_delete on public.evolution_photos;
-- Só a dona ou o dono vê; o grupo vê apenas as que a pessoa escolheu mostrar.
create policy evolution_photos_select on public.evolution_photos for select to authenticated
  using (user_id = auth.uid() or (shared and public.is_member(group_id)));
create policy evolution_photos_insert on public.evolution_photos for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(group_id));
create policy evolution_photos_update on public.evolution_photos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy evolution_photos_delete on public.evolution_photos for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.evolution_photos from anon;
revoke insert, update on public.evolution_photos from authenticated;
grant insert (group_id, photo_path, taken_on, weight_kg, note, shared) on public.evolution_photos to authenticated;
grant update (weight_kg, note, shared) on public.evolution_photos to authenticated;

insert into storage.buckets (id, name, public)
values ('evolution', 'evolution', false)
on conflict (id) do nothing;

create or replace function public.can_read_evolution_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select split_part(object_name, '/', 1) = auth.uid()::text
      or exists (select 1 from public.evolution_photos p
                 where p.photo_path = object_name and p.shared and public.is_member(p.group_id));
$$;

drop policy if exists "evolution: dono e quem recebeu veem" on storage.objects;
drop policy if exists "evolution: cada um envia na propria pasta" on storage.objects;
drop policy if exists "evolution: cada um apaga as proprias fotos" on storage.objects;
create policy "evolution: dono e quem recebeu veem"
  on storage.objects for select to authenticated
  using (bucket_id = 'evolution' and public.can_read_evolution_photo(name));
create policy "evolution: cada um envia na propria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evolution' and split_part(name, '/', 1) = auth.uid()::text);
create policy "evolution: cada um apaga as proprias fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evolution' and split_part(name, '/', 1) = auth.uid()::text);
