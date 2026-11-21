-- =====================================================================
-- Treino a Dois: leva 2 das funções do casal.
--
-- F6. Exceção com resposta do parceiro: quem não marcou a exceção pode RECUSAR até as
--     23h59 (fuso do grupo) do dia em que ela foi marcada. Sem resposta até lá, ela vale.
--     Recusar = apagar a exceção e deixar um registro no feed (mesmo jeito do "reportar
--     treino"). Assim close_week e o placar do app continuam iguais: só contam as exceções
--     que existem. Aprovar só deixa marcado que o parceiro viu.
-- F3. Roleta de prêmios: a cada 2 semanas seguidas em que todo mundo bate a meta (o
--     coringa não quebra a sequência, mas não soma), o grupo ganha um giro. O sorteio é
--     feito aqui no banco e cada marco só pode ser girado uma vez.
-- F5. Planejar a semana e "vamos?": cada um marca os dias em que pretende treinar, e dá
--     para chamar o outro. O aviso aparece dentro do app (sem notificação por enquanto).
--
-- Nada aqui muda meta, multa ou close_week. Só adiciona tabelas, colunas e funções.
-- =====================================================================

-- ---------------------------------------------------------------------
-- F6. Exceção com resposta do parceiro
-- ---------------------------------------------------------------------

alter table public.exceptions
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

create table if not exists public.exception_rejections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Sem chave estrangeira: a exceção é apagada ao ser recusada.
  exception_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  rejected_by uuid references auth.users (id) on delete set null,
  day date not null,
  reason public.exception_reason not null,
  note text,
  why text check (why is null or char_length(why) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists exception_rejections_group_idx on public.exception_rejections (group_id, created_at desc);

alter table public.exception_rejections enable row level security;

drop policy if exists exception_rejections_select on public.exception_rejections;
create policy exception_rejections_select on public.exception_rejections for select to authenticated
  using (public.is_member(group_id));

revoke all on public.exception_rejections from anon;
revoke insert, update, delete on public.exception_rejections from authenticated;

-- Mesmo gatilho de antes (20261113000001_schema.sql), mais uma regra: depois que o parceiro
-- recusa um dia, a pessoa não pode marcar exceção nesse mesmo dia de novo.
create or replace function public.exceptions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := public.local_today(new.group_id);
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

  return new;
end;
$$;

-- Último dia para responder: o dia (no fuso do grupo) em que a exceção foi marcada.
create or replace function public.exception_review_deadline(p_created_at timestamptz, gid uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (p_created_at at time zone g.timezone)::date from public.groups g where g.id = gid;
$$;

create or replace function public.review_exception(p_exception uuid, p_approve boolean, p_why text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.exceptions;
  why text := nullif(trim(coalesce(p_why, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Faça login primeiro';
  end if;

  -- Trava a linha: duas pessoas respondendo ao mesmo tempo esperam uma pela outra.
  select * into e from public.exceptions where id = p_exception for update;
  -- Quem não é do grupo recebe a mesma resposta de uma exceção que não existe.
  if not found or not public.is_member(e.group_id) then
    raise exception 'Exceção não encontrada';
  end if;

  if e.user_id = auth.uid() then
    raise exception 'A exceção é sua: quem responde é o seu parceiro' using errcode = 'P0001';
  end if;

  if e.reviewed_at is not null then
    raise exception 'Essa exceção já foi aprovada' using errcode = 'P0001';
  end if;

  if public.local_today(e.group_id) > public.exception_review_deadline(e.created_at, e.group_id) then
    raise exception 'O prazo para responder acabou às 23h59 do dia em que a exceção foi marcada. Ela já vale' using errcode = 'P0001';
  end if;

  if public.week_is_closed(e.group_id, e.day) then
    raise exception 'Essa semana já foi fechada. A exceção já valeu' using errcode = 'P0001';
  end if;

  if why is not null and char_length(why) > 200 then
    raise exception 'O motivo pode ter até 200 letras' using errcode = 'P0001';
  end if;

  if p_approve then
    update public.exceptions set reviewed_by = auth.uid(), reviewed_at = now() where id = e.id;
    return;
  end if;

  insert into public.exception_rejections (group_id, exception_id, author_id, rejected_by, day, reason, note, why)
  values (e.group_id, e.id, e.user_id, auth.uid(), e.day, e.reason, e.note, why);

  -- O gatilho exceptions_block_closed recusa se a semana já tiver fechado.
  delete from public.exceptions where id = e.id;
end;
$$;

revoke execute on function public.review_exception(uuid, boolean, text) from public, anon;
grant execute on function public.review_exception(uuid, boolean, text) to authenticated;
revoke execute on function public.exception_review_deadline(timestamptz, uuid) from public, anon;
grant execute on function public.exception_review_deadline(timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- F3. Roleta de prêmios
-- ---------------------------------------------------------------------

-- A cada quantas semanas seguidas o grupo ganha um giro. Igual a REWARD_EVERY_WEEKS em src/domain/rewards.ts.
create or replace function public.reward_every_weeks()
returns int
language sql
immutable
as $$ select 2 $$;

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists rewards_group_idx on public.rewards (group_id, created_at);

create table if not exists public.reward_spins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Segunda-feira da semana que completou o marco (2, 4, 6... semanas seguidas).
  week_start date not null check (extract(isodow from week_start) = 1),
  reward_id uuid references public.rewards (id) on delete set null,
  reward_text text not null,
  spun_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  constraint one_spin_per_milestone unique (group_id, week_start)
);

alter table public.rewards enable row level security;
alter table public.reward_spins enable row level security;

drop policy if exists rewards_select on public.rewards;
drop policy if exists rewards_insert on public.rewards;
drop policy if exists rewards_update on public.rewards;
drop policy if exists rewards_delete on public.rewards;
create policy rewards_select on public.rewards for select to authenticated using (public.is_member(group_id));
create policy rewards_insert on public.rewards for insert to authenticated with check (public.is_member(group_id));
create policy rewards_update on public.rewards for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy rewards_delete on public.rewards for delete to authenticated using (public.is_member(group_id));

drop policy if exists reward_spins_select on public.reward_spins;
drop policy if exists reward_spins_update on public.reward_spins;
create policy reward_spins_select on public.reward_spins for select to authenticated using (public.is_member(group_id));
create policy reward_spins_update on public.reward_spins for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));

revoke all on public.rewards, public.reward_spins from anon;
revoke insert, update on public.rewards from authenticated;
grant insert (group_id, description) on public.rewards to authenticated;
grant update (description, active) on public.rewards to authenticated;
-- Giro só pela função abaixo; o grupo só marca quando aproveitou o prêmio.
revoke insert, update, delete on public.reward_spins from authenticated;
grant update (redeemed_at) on public.reward_spins to authenticated;

-- Prêmios iniciais (editáveis no app), para grupos novos e para os que já existem.
create or replace function public.seed_rewards(gid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.rewards (group_id, description, created_by) values
    (gid, 'Massagem de 20 minutos', null),
    (gid, 'Jantar fora, e o outro escolhe o lugar', null),
    (gid, 'Folga de uma tarefa da casa por uma semana', null),
    (gid, 'Café da manhã na cama', null),
    (gid, 'Escolher o filme ou a série da semana', null),
    (gid, 'Sobremesa liberada sem culpa', null);
$$;

revoke execute on function public.seed_rewards(uuid) from public, anon, authenticated;

create or replace function public.groups_after_insert_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_rewards(new.id);
  return new;
end;
$$;

drop trigger if exists groups_after_insert_rewards on public.groups;
create trigger groups_after_insert_rewards
  after insert on public.groups
  for each row execute function public.groups_after_insert_rewards();

do $$
declare gid uuid;
begin
  for gid in select g.id from public.groups g where not exists (select 1 from public.rewards r where r.group_id = g.id) loop
    perform public.seed_rewards(gid);
  end loop;
end $$;

-- Gira a roleta de prêmios do marco que terminou na semana p_week_start.
-- Confere a sequência do grupo com a mesma regra de src/domain/streak.ts (groupStreak).
create or replace function public.spin_reward(gid uuid, p_week_start date)
returns public.reward_spins
language plpgsql
security definer
set search_path = public
as $$
declare
  wk record;
  streak int := 0;
  ok boolean := false;
  r public.rewards;
  spin public.reward_spins;
begin
  if auth.uid() is null or not public.is_member(gid) then
    raise exception 'Você não faz parte deste grupo';
  end if;

  -- Semana a semana, em ordem: todo mundo bateu soma; alguém falhou sem coringa zera.
  for wk in
    select week_start,
           bool_and(met) as all_met,
           bool_and(met or used_joker) as all_saved
    from public.week_results
    where group_id = gid and week_start <= p_week_start
    group by week_start
    order by week_start
  loop
    if wk.all_met then
      streak := streak + 1;
      ok := wk.week_start = p_week_start and streak % public.reward_every_weeks() = 0;
    elsif not wk.all_saved then
      streak := 0;
      ok := false;
    else
      ok := false;
    end if;
  end loop;

  if not ok then
    raise exception 'Essa semana não completou % semanas seguidas de meta batida', public.reward_every_weeks() using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reward_spins s where s.group_id = gid and s.week_start = p_week_start) then
    raise exception 'A roleta deste prêmio já foi girada' using errcode = 'P0001';
  end if;

  select * into r from public.rewards where group_id = gid and active order by random() limit 1;
  if not found then
    raise exception 'Cadastre pelo menos um prêmio ativo antes de girar' using errcode = 'P0001';
  end if;

  -- Se os dois giram ao mesmo tempo, só o primeiro grava.
  insert into public.reward_spins (group_id, week_start, reward_id, reward_text, spun_by)
  values (gid, p_week_start, r.id, r.description, auth.uid())
  on conflict (group_id, week_start) do nothing
  returning * into spin;
  if spin.id is null then
    raise exception 'A roleta deste prêmio já foi girada' using errcode = 'P0001';
  end if;
  return spin;
end;
$$;

revoke execute on function public.spin_reward(uuid, date) from public, anon;
grant execute on function public.spin_reward(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- F5. Planejar a semana e "vamos?"
-- ---------------------------------------------------------------------

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  day date not null,
  period text check (period is null or period in ('manha', 'tarde', 'noite')),
  created_at timestamptz not null default now(),
  constraint one_plan_per_day unique (group_id, user_id, day)
);

create index if not exists workout_plans_group_day_idx on public.workout_plans (group_id, day);

create or replace function public.workout_plans_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := public.local_today(new.group_id);
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  if new.day < today then
    raise exception 'Esse dia já passou' using errcode = 'P0001';
  end if;
  if new.day > today + 13 then
    raise exception 'Dá para planejar só as próximas duas semanas' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists workout_plans_before_insert on public.workout_plans;
create trigger workout_plans_before_insert
  before insert on public.workout_plans
  for each row execute function public.workout_plans_before_insert();

alter table public.workout_plans enable row level security;

drop policy if exists workout_plans_select on public.workout_plans;
drop policy if exists workout_plans_insert on public.workout_plans;
drop policy if exists workout_plans_update on public.workout_plans;
drop policy if exists workout_plans_delete on public.workout_plans;
create policy workout_plans_select on public.workout_plans for select to authenticated using (public.is_member(group_id));
create policy workout_plans_insert on public.workout_plans for insert to authenticated
  with check (public.is_member(group_id) and user_id = auth.uid());
create policy workout_plans_update on public.workout_plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workout_plans_delete on public.workout_plans for delete to authenticated using (user_id = auth.uid());

revoke all on public.workout_plans from anon;
revoke insert, update on public.workout_plans from authenticated;
grant insert (group_id, day, period) on public.workout_plans to authenticated;
grant update (period) on public.workout_plans to authenticated;

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade default auth.uid(),
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index if not exists nudges_to_idx on public.nudges (to_user, created_at desc);

create or replace function public.nudges_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.from_user := auth.uid();
  new.created_at := now();
  new.seen_at := null;
  if new.to_user = new.from_user then
    raise exception 'Chame outra pessoa do grupo' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = new.to_user) then
    raise exception 'Essa pessoa não está no grupo' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.nudges n
             where n.from_user = new.from_user and n.to_user = new.to_user
               and n.created_at > now() - interval '30 minutes') then
    raise exception 'Você já chamou há pouco. Espere meia hora para chamar de novo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists nudges_before_insert on public.nudges;
create trigger nudges_before_insert
  before insert on public.nudges
  for each row execute function public.nudges_before_insert();

alter table public.nudges enable row level security;

drop policy if exists nudges_select on public.nudges;
drop policy if exists nudges_insert on public.nudges;
drop policy if exists nudges_update on public.nudges;
create policy nudges_select on public.nudges for select to authenticated
  using (public.is_member(group_id) and (from_user = auth.uid() or to_user = auth.uid()));
create policy nudges_insert on public.nudges for insert to authenticated with check (public.is_member(group_id));
create policy nudges_update on public.nudges for update to authenticated
  using (to_user = auth.uid()) with check (to_user = auth.uid());

revoke all on public.nudges from anon;
revoke insert, update, delete on public.nudges from authenticated;
grant insert (group_id, to_user) on public.nudges to authenticated;
grant update (seen_at) on public.nudges to authenticated;
