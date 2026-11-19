-- =====================================================================
-- Treino a Dois: verificação de localização na academia
-- O grupo cadastra suas academias (busca no Google Maps ou posição atual).
-- No check-in o app manda a posição do GPS e o banco confere se a pessoa
-- está a até 300 m de alguma academia do grupo.
-- =====================================================================

-- Distância em metros entre dois pontos (fórmula de haversine, raio médio da Terra).
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Raio permitido em volta da academia.
create or replace function public.gym_radius_m()
returns int
language sql
immutable
as $$ select 300; $$;

-- ---------------------------------------------------------------------
-- Regra por grupo: exigir localização no check-in (ligado por padrão)
-- ---------------------------------------------------------------------
alter table public.groups add column require_location boolean not null default true;
grant update (require_location) on public.groups to authenticated;

-- ---------------------------------------------------------------------
-- Academias do grupo
-- ---------------------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  address text check (address is null or char_length(address) <= 200),
  -- Identificador do lugar no Google Maps (nulo quando cadastrada pela posição atual).
  place_id text check (place_id is null or char_length(place_id) <= 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index gyms_group_idx on public.gyms (group_id);

create or replace function public.gyms_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  new.name := trim(new.name);
  if (select count(*) from public.gyms where group_id = new.group_id) >= 10 then
    raise exception 'O grupo já tem 10 academias cadastradas. Remova uma antes de adicionar outra';
  end if;
  return new;
end;
$$;

create trigger gyms_before_insert
  before insert on public.gyms
  for each row execute function public.gyms_before_insert();

alter table public.gyms enable row level security;

create policy gyms_select on public.gyms for select to authenticated
  using (public.is_member(group_id));
create policy gyms_insert on public.gyms for insert to authenticated
  with check (public.is_member(group_id));
create policy gyms_delete on public.gyms for delete to authenticated
  using (public.is_member(group_id));

revoke update on public.gyms from authenticated;
revoke all on public.gyms from anon;

-- ---------------------------------------------------------------------
-- Posição no check-in
-- ---------------------------------------------------------------------
alter table public.checkins
  add column lat double precision check (lat is null or lat between -90 and 90),
  add column lng double precision check (lng is null or lng between -180 and 180),
  add column accuracy_m real check (accuracy_m is null or accuracy_m >= 0),
  add column gym_id uuid references public.gyms (id) on delete set null,
  -- Guardamos o nome para o feed continuar certo se a academia for removida.
  add column gym_name text,
  add column distance_m int;

-- Mesmas regras de antes, mais a conferência da localização.
create or replace function public.checkins_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  nearest record;
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

  -- O banco decide a academia e a distância; o app só manda a posição.
  new.gym_id := null;
  new.gym_name := null;
  new.distance_m := null;

  if (new.lat is null) <> (new.lng is null) then
    raise exception 'Localização incompleta';
  end if;

  if new.lat is not null then
    select gy.id, gy.name, public.distance_m(new.lat, new.lng, gy.lat, gy.lng) as d
      into nearest
    from public.gyms gy
    where gy.group_id = new.group_id
    order by 3
    limit 1;

    if found then
      new.gym_id := nearest.id;
      new.gym_name := nearest.name;
      new.distance_m := round(nearest.d)::int;
    end if;
  end if;

  if g.require_location then
    if new.lat is null then
      raise exception 'Ative a localização para registrar o treino' using errcode = 'P0001';
    end if;
    if new.gym_id is null then
      raise exception 'Cadastre a academia do grupo antes de registrar o treino' using errcode = 'P0001';
    end if;
    if new.accuracy_m is not null and new.accuracy_m > 500 then
      raise exception 'Sinal de GPS fraco. Espere alguns segundos e tente de novo' using errcode = 'P0001';
    end if;
    if new.distance_m > public.gym_radius_m() then
      raise exception 'Você está a % m da academia mais próxima (%). O limite é % m',
        new.distance_m, new.gym_name, public.gym_radius_m() using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
