-- =====================================================================
-- Treino a Dois: reações nas fotos e tipo de treino opcional.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipo de treino (opcional). Não mexe em nenhuma regra de meta ou multa.
-- O insert em checkins já é liberado por tabela, então a coluna nova entra sem novo grant.
-- ---------------------------------------------------------------------
alter table public.checkins
  add column kind text check (kind is null or kind in ('musculacao', 'cardio', 'aula', 'outro'));

-- ---------------------------------------------------------------------
-- Reações: um emoji por pessoa em cada check-in
-- ---------------------------------------------------------------------
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  -- Copiado do check-in pelo gatilho (não vem do app), para a regra de segurança ser simples.
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  emoji text not null check (emoji in ('💪', '🔥', '👏', '😍')),
  created_at timestamptz not null default now(),
  constraint one_reaction_per_checkin unique (checkin_id, user_id)
);

create index reactions_checkin_idx on public.reactions (checkin_id);

create or replace function public.reactions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.group_id into new.group_id from public.checkins c where c.id = new.checkin_id;
  if new.group_id is null then
    raise exception 'Check-in não encontrado';
  end if;
  new.user_id := coalesce(auth.uid(), new.user_id);
  new.created_at := now();
  return new;
end;
$$;

create trigger reactions_before_insert
  before insert on public.reactions
  for each row execute function public.reactions_before_insert();

alter table public.reactions enable row level security;

create policy reactions_select on public.reactions for select to authenticated
  using (public.is_member(group_id));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (public.is_member(group_id) and user_id = auth.uid());
create policy reactions_update on public.reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.reactions from anon;
-- Só o emoji pode mudar; check-in, grupo e autor ficam como foram criados.
revoke update on public.reactions from authenticated;
grant update (emoji) on public.reactions to authenticated;
