-- =====================================================================
-- Treino a Dois: cada pessoa tem as próprias academias.
-- - O check-in só vale perto de uma academia que a própria pessoa cadastrou.
-- - Só quem cadastrou pode excluir a academia.
-- - O limite de 10 academias passa a ser por pessoa (era por grupo).
-- Todos do grupo continuam vendo todas as academias (o parceiro sabe onde o outro treina).
-- =====================================================================

-- Só quem cadastrou exclui.
drop policy if exists gyms_delete on public.gyms;
create policy gyms_delete on public.gyms for delete to authenticated
  using (public.is_member(group_id) and created_by = auth.uid());

-- Limite por pessoa.
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
  if (select count(*) from public.gyms
      where group_id = new.group_id and created_by = new.created_by) >= 10 then
    raise exception 'Você já tem 10 academias cadastradas. Exclua uma antes de adicionar outra';
  end if;
  return new;
end;
$$;

-- Mesmas regras de check-in de antes; a academia mais próxima agora é procurada
-- só entre as academias da própria pessoa.
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
      and gy.created_by = new.user_id
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
      raise exception 'Cadastre a sua academia antes de registrar o treino' using errcode = 'P0001';
    end if;
    if new.accuracy_m is not null and new.accuracy_m > 500 then
      raise exception 'Sinal de GPS fraco. Espere alguns segundos e tente de novo' using errcode = 'P0001';
    end if;
    if new.distance_m > public.gym_radius_m() then
      raise exception 'Você está a % m da sua academia mais próxima (%). O limite é % m',
        new.distance_m, new.gym_name, public.gym_radius_m() using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;
