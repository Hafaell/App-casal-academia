-- =====================================================================
-- Treino a Dois: esquema principal
-- Todas as regras ficam guardadas no grupo (meta, faixa de multa, roleta),
-- para que o mesmo banco sirva depois para grupos de amigos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.exception_reason as enum ('doenca', 'viagem', 'lesao', 'menstruacao');

-- ---------------------------------------------------------------------
-- Funções de data (semana de segunda a domingo)
-- ---------------------------------------------------------------------
create or replace function public.monday_of(d date)
returns date
language sql
immutable
as $$
  select d - (extract(isodow from d)::int - 1);
$$;

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando a pessoa se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Grupos e membros
-- ---------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  weekly_goal int not null default 4 check (weekly_goal between 1 and 7),
  fine_min int not null default 10 check (fine_min >= 0),
  fine_max int not null default 50,
  sunday_counts boolean not null default false,
  jokers_per_month int not null default 1 check (jokers_per_month between 0 and 4),
  timezone text not null default 'America/Sao_Paulo',
  -- Primeira segunda-feira que vale para a meta (semanas anteriores não fecham).
  starts_on date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fine_range check (fine_max >= fine_min),
  constraint starts_on_monday check (extract(isodow from starts_on) = 1)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  -- Primeira segunda-feira em que a meta vale para esta pessoa.
  starts_on date not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Funções auxiliares usadas pelas políticas (security definer evita recursão no RLS).
create or replace function public.is_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_group(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function public.local_today(gid uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone g.timezone)::date from public.groups g where g.id = gid;
$$;

create or replace function public.week_is_closed(gid uuid, d date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.weeks w
    where w.group_id = gid and w.week_start = public.monday_of(d)
  );
end;
$$;

-- Segunda-feira em que uma pessoa que entra hoje passa a ter meta:
-- hoje, se hoje for segunda; senão, a próxima segunda.
create or replace function public.first_monday_from(d date)
returns date
language sql
immutable
as $$
  select case when extract(isodow from d) = 1 then d else public.monday_of(d) + 7 end;
$$;

-- ---------------------------------------------------------------------
-- Roleta de punições
-- ---------------------------------------------------------------------
create table public.punishments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  description text not null check (char_length(description) between 1 and 200),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index punishments_group_idx on public.punishments (group_id);

-- ---------------------------------------------------------------------
-- Check-ins (1 por pessoa por dia)
-- ---------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  day date not null,
  photo_path text not null,
  created_at timestamptz not null default now(),
  constraint one_checkin_per_day unique (group_id, user_id, day)
);

create index checkins_group_day_idx on public.checkins (group_id, day desc);

-- Data e hora vêm sempre do servidor, nunca do aparelho.
create or replace function public.checkins_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = new.group_id;
  if not found then
    raise exception 'Grupo não encontrado';
  end if;

  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  new.day := (now() at time zone g.timezone)::date;

  if extract(isodow from new.day) = 7 and not g.sunday_counts then
    raise exception 'Domingo é folga: o check-in não vale hoje' using errcode = 'P0001';
  end if;

  if new.photo_path not like new.group_id::text || '/' || new.user_id::text || '/%' then
    raise exception 'Caminho da foto inválido';
  end if;

  if exists (select 1 from public.checkins c
             where c.group_id = new.group_id and c.user_id = new.user_id and c.day = new.day) then
    raise exception 'Você já registrou o treino de hoje' using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger checkins_before_insert
  before insert on public.checkins
  for each row execute function public.checkins_before_insert();

-- ---------------------------------------------------------------------
-- Exceções (dias justificados) e coringas
-- ---------------------------------------------------------------------
create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  day date not null,
  reason public.exception_reason not null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  constraint one_exception_per_day unique (group_id, user_id, day)
);

create index exceptions_group_day_idx on public.exceptions (group_id, day desc);

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

  return new;
end;
$$;

create trigger exceptions_before_insert
  before insert on public.exceptions
  for each row execute function public.exceptions_before_insert();

create table public.jokers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  constraint one_joker_per_week unique (group_id, user_id, week_start)
);

create or replace function public.jokers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  used int;
begin
  select * into g from public.groups where id = new.group_id;
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();

  if new.week_start <> public.monday_of(public.local_today(new.group_id)) then
    raise exception 'O coringa só pode ser usado na semana atual';
  end if;
  if public.week_is_closed(new.group_id, new.week_start) then
    raise exception 'Essa semana já foi fechada';
  end if;

  select count(*) into used
  from public.jokers j
  where j.group_id = new.group_id
    and j.user_id = new.user_id
    and date_trunc('month', j.week_start) = date_trunc('month', new.week_start);

  if used >= g.jokers_per_month then
    raise exception 'Você já usou o coringa deste mês';
  end if;

  return new;
end;
$$;

create trigger jokers_before_insert
  before insert on public.jokers
  for each row execute function public.jokers_before_insert();

-- Não deixa apagar check-in, exceção ou coringa de semana já fechada.
create or replace function public.block_changes_in_closed_week()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := coalesce(to_jsonb(old) ->> 'day', to_jsonb(old) ->> 'week_start')::date;
begin
  if public.week_is_closed(old.group_id, d) then
    raise exception 'Essa semana já foi fechada';
  end if;
  return old;
end;
$$;

create trigger checkins_block_closed before delete on public.checkins
  for each row execute function public.block_changes_in_closed_week();
create trigger exceptions_block_closed before delete on public.exceptions
  for each row execute function public.block_changes_in_closed_week();
create trigger jokers_block_closed before delete on public.jokers
  for each row execute function public.block_changes_in_closed_week();

-- ---------------------------------------------------------------------
-- Fechamento da semana
-- ---------------------------------------------------------------------
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  closed_at timestamptz not null default now(),
  -- Sorteio único da semana: se mais de uma pessoa falhar, todas pagam o mesmo.
  fine_amount int,
  punishment_id uuid references public.punishments (id) on delete set null,
  punishment_kind text,
  punishment_text text,
  constraint one_close_per_week unique (group_id, week_start)
);

create table public.week_results (
  week_id uuid not null references public.weeks (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  base_goal int not null,
  exception_days int not null,
  goal int not null,
  checkins int not null,
  used_joker boolean not null,
  met boolean not null,
  owes boolean not null,
  fine_amount int not null default 0,
  punishment_text text,
  paid_at timestamptz,
  paid_marked_by uuid references auth.users (id) on delete set null,
  task_done_at timestamptz,
  primary key (week_id, user_id)
);

create index week_results_group_idx on public.week_results (group_id, week_start desc);

-- Fecha uma semana específica de um grupo. Idempotente: se já foi fechada, não faz nada.
create or replace function public.close_week(gid uuid, wstart date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  wid uuid;
  fine int;
  pun public.punishments;
  anyone_owes boolean;
begin
  if extract(isodow from wstart) <> 1 then
    raise exception 'week_start precisa ser segunda-feira';
  end if;

  select * into g from public.groups where id = gid;
  if not found then
    raise exception 'Grupo não encontrado';
  end if;

  insert into public.weeks (group_id, week_start)
  values (gid, wstart)
  on conflict (group_id, week_start) do nothing
  returning id into wid;

  if wid is null then
    return null; -- já estava fechada
  end if;

  insert into public.week_results (
    week_id, group_id, user_id, week_start,
    base_goal, exception_days, goal, checkins, used_joker, met, owes
  )
  select
    wid, gid, m.user_id, wstart,
    g.weekly_goal,
    x.exception_days,
    greatest(0, g.weekly_goal - x.exception_days),
    c.checkins,
    j.used_joker,
    c.checkins >= greatest(0, g.weekly_goal - x.exception_days),
    c.checkins < greatest(0, g.weekly_goal - x.exception_days) and not j.used_joker
  from public.group_members m
  cross join lateral (
    -- Só reduzem a meta os dias úteis justificados em que a pessoa não treinou.
    select count(*)::int as exception_days
    from public.exceptions e
    where e.group_id = gid and e.user_id = m.user_id
      and e.day between wstart and wstart + 4
      and not exists (select 1 from public.checkins c2
                      where c2.group_id = gid and c2.user_id = m.user_id and c2.day = e.day)
  ) x
  cross join lateral (
    select count(*)::int as checkins
    from public.checkins c
    where c.group_id = gid and c.user_id = m.user_id
      and c.day between wstart and wstart + 6
      and (extract(isodow from c.day) < 7 or g.sunday_counts)
  ) c
  cross join lateral (
    select exists (select 1 from public.jokers jk
                   where jk.group_id = gid and jk.user_id = m.user_id and jk.week_start = wstart) as used_joker
  ) j
  where m.group_id = gid
    and m.starts_on <= wstart;

  select exists (select 1 from public.week_results r where r.week_id = wid and r.owes) into anyone_owes;

  if anyone_owes then
    fine := g.fine_min + floor(random() * (g.fine_max - g.fine_min + 1))::int;

    select * into pun
    from public.punishments p
    where p.group_id = gid and p.active
    order by random()
    limit 1;

    update public.weeks
    set fine_amount = fine,
        punishment_id = pun.id,
        punishment_kind = pun.kind,
        punishment_text = pun.description
    where id = wid;

    update public.week_results
    set fine_amount = fine,
        punishment_text = pun.description
    where week_id = wid and owes;
  end if;

  return wid;
end;
$$;

-- Fecha todas as semanas vencidas de um grupo (ou de todos, quando gid é nulo).
-- Uma semana vence no domingo às 23h59, no fuso do grupo.
create or replace function public.close_due_weeks(gid uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  w date;
  closed int := 0;
  local_now timestamp;
begin
  for g in select * from public.groups where gid is null or id = gid loop
    local_now := now() at time zone g.timezone;

    select coalesce(max(week_start) + 7, g.starts_on) into w
    from public.weeks where group_id = g.id;

    while (w + 6) + time '23:59' <= local_now loop
      if public.close_week(g.id, w) is not null then
        closed := closed + 1;
      end if;
      w := w + 7;
    end loop;
  end loop;

  return closed;
end;
$$;

-- Versão que o app chama ao abrir: rede de segurança caso o agendamento atrase.
create or replace function public.catch_up_weeks(gid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(gid) then
    raise exception 'Você não faz parte deste grupo';
  end if;
  return public.close_due_weeks(gid);
end;
$$;

-- ---------------------------------------------------------------------
-- Caixinha: marcar multa paga e tarefa cumprida
-- ---------------------------------------------------------------------
create or replace function public.set_debt_status(
  p_week_id uuid,
  p_user_id uuid,
  p_paid boolean default null,
  p_task_done boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.week_results;
begin
  select * into r from public.week_results where week_id = p_week_id and user_id = p_user_id;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if not public.is_member(r.group_id) then
    raise exception 'Você não faz parte deste grupo';
  end if;
  if not r.owes then
    raise exception 'Essa pessoa não deve nada nessa semana';
  end if;

  update public.week_results
  set paid_at = case when p_paid is null then paid_at when p_paid then coalesce(paid_at, now()) else null end,
      paid_marked_by = case when p_paid is null then paid_marked_by when p_paid then auth.uid() else null end,
      task_done_at = case when p_task_done is null then task_done_at when p_task_done then coalesce(task_done_at, now()) else null end
  where week_id = p_week_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Criar grupo e entrar por convite
-- ---------------------------------------------------------------------
create or replace function public.create_group(p_name text, p_timezone text default 'America/Sao_Paulo')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  today date;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Faça login primeiro';
  end if;

  -- Valida o fuso horário (lança erro se não existir).
  perform now() at time zone p_timezone;
  today := (now() at time zone p_timezone)::date;

  insert into public.groups (name, timezone, starts_on, created_by)
  values (trim(p_name), p_timezone, public.first_monday_from(today), uid)
  returning id into gid;

  insert into public.group_members (group_id, user_id, role, starts_on)
  values (gid, uid, 'owner', public.first_monday_from(today));

  -- Roleta inicial sugerida no briefing (editável no app).
  insert into public.punishments (group_id, kind, description, created_by) values
    (gid, 'Tarefa', 'Lavar a louça a semana toda', uid),
    (gid, 'Tarefa', 'Limpar o banheiro', uid),
    (gid, 'Tarefa', 'Fazer a marmita da semana seguinte', uid),
    (gid, 'Perda de escolha', 'Sem direito a escolher filme, série ou restaurante por 1 semana', uid),
    (gid, 'Date', 'Pagar o próximo date, e o outro escolhe o lugar', uid),
    (gid, 'Constrangimento leve', 'Postar um story escolhido pelo outro', uid),
    (gid, 'Constrangimento leve', 'Usar uma foto de perfil escolhida pelo outro por 3 dias', uid),
    (gid, 'Constrangimento leve', 'Mandar um áudio cantando no grupo da família ou dos amigos', uid);

  return gid;
end;
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Faça login primeiro';
  end if;

  select * into g from public.groups where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'Código de convite inválido';
  end if;

  insert into public.group_members (group_id, user_id, role, starts_on)
  values (
    g.id, uid, 'member',
    greatest(g.starts_on, public.first_monday_from((now() at time zone g.timezone)::date))
  )
  on conflict (group_id, user_id) do nothing;

  return g.id;
end;
$$;

create or replace function public.leave_group(gid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.group_members where group_id = gid and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.punishments enable row level security;
alter table public.checkins enable row level security;
alter table public.exceptions enable row level security;
alter table public.jokers enable row level security;
alter table public.weeks enable row level security;
alter table public.week_results enable row level security;

-- Perfis: a própria pessoa e quem divide grupo com ela.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Grupos: membros leem e editam as regras.
create policy groups_select on public.groups for select to authenticated
  using (public.is_member(id));
create policy groups_update on public.groups for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy members_select on public.group_members for select to authenticated
  using (public.is_member(group_id));

create policy punishments_select on public.punishments for select to authenticated
  using (public.is_member(group_id));
create policy punishments_insert on public.punishments for insert to authenticated
  with check (public.is_member(group_id));
create policy punishments_update on public.punishments for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy punishments_delete on public.punishments for delete to authenticated
  using (public.is_member(group_id));

create policy checkins_select on public.checkins for select to authenticated
  using (public.is_member(group_id));
create policy checkins_insert on public.checkins for insert to authenticated
  with check (public.is_member(group_id) and user_id = auth.uid());
create policy checkins_delete on public.checkins for delete to authenticated
  using (user_id = auth.uid());

create policy exceptions_select on public.exceptions for select to authenticated
  using (public.is_member(group_id));
create policy exceptions_insert on public.exceptions for insert to authenticated
  with check (public.is_member(group_id) and user_id = auth.uid());
create policy exceptions_delete on public.exceptions for delete to authenticated
  using (user_id = auth.uid());

create policy jokers_select on public.jokers for select to authenticated
  using (public.is_member(group_id));
create policy jokers_insert on public.jokers for insert to authenticated
  with check (public.is_member(group_id) and user_id = auth.uid());
create policy jokers_delete on public.jokers for delete to authenticated
  using (user_id = auth.uid());

create policy weeks_select on public.weeks for select to authenticated
  using (public.is_member(group_id));
create policy week_results_select on public.week_results for select to authenticated
  using (public.is_member(group_id));

-- ---------------------------------------------------------------------
-- Permissões por coluna (o RLS diz QUAIS linhas; aqui definimos O QUE pode mudar)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;

revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke insert, update, delete on public.groups from authenticated;
grant update (name, weekly_goal, fine_min, fine_max, sunday_counts, jokers_per_month) on public.groups to authenticated;

revoke insert, update, delete on public.group_members from authenticated;

revoke update on public.punishments from authenticated;
grant update (kind, description, active) on public.punishments to authenticated;

revoke update on public.checkins, public.exceptions, public.jokers from authenticated;
revoke insert, update, delete on public.weeks, public.week_results from authenticated;

-- Funções internas não ficam expostas pela API.
revoke execute on function public.close_week(uuid, date) from public, anon, authenticated;
revoke execute on function public.close_due_weeks(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
