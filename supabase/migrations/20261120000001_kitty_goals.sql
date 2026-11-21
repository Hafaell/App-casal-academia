-- ---------------------------------------------------------------------
-- Caixinha com objetivo
--
-- O objetivo dá um destino ao dinheiro das multas (viagem, jantar, presente).
-- O progresso é o saldo da caixinha: multas pagas menos retiradas.
-- Nada aqui muda a regra de dinheiro (close_week, meta, multa).
-- ---------------------------------------------------------------------

create table public.kitty_goals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  target_amount int not null check (target_amount between 1 and 1000000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  withdrawal_id uuid references public.kitty_withdrawals (id) on delete set null
);

-- Um objetivo aberto por grupo.
create unique index kitty_goals_one_open on public.kitty_goals (group_id) where completed_at is null;
create index kitty_goals_group_idx on public.kitty_goals (group_id, created_at desc);

alter table public.kitty_goals enable row level security;

create policy kitty_goals_select on public.kitty_goals for select to authenticated
  using (public.is_member(group_id));
create policy kitty_goals_insert on public.kitty_goals for insert to authenticated
  with check (public.is_member(group_id));
create policy kitty_goals_update on public.kitty_goals for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy kitty_goals_delete on public.kitty_goals for delete to authenticated
  using (public.is_member(group_id));

-- Só dá para escolher o grupo, o nome e o valor. Concluir é pela função abaixo.
revoke all on public.kitty_goals from anon;
revoke insert, update on public.kitty_goals from authenticated;
grant insert (group_id, title, target_amount) on public.kitty_goals to authenticated;
grant update (title, target_amount) on public.kitty_goals to authenticated;

-- Usa o dinheiro do objetivo: registra a retirada e conclui o objetivo, tudo ou nada.
create or replace function public.complete_kitty_goal(p_goal uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.kitty_goals;
  balance int;
  wid uuid;
begin
  select * into g from public.kitty_goals where id = p_goal for update;
  if g.id is null or not public.is_member(g.group_id) then
    raise exception 'Objetivo não encontrado';
  end if;
  if g.completed_at is not null then
    raise exception 'Este objetivo já foi concluído';
  end if;

  balance :=
    coalesce((select sum(fine_amount) from public.week_results
              where group_id = g.group_id and owes and paid_at is not null), 0)
    - coalesce((select sum(amount) from public.kitty_withdrawals where group_id = g.group_id), 0);
  if balance < g.target_amount then
    raise exception 'A caixinha tem R$ %, falta R$ % para o objetivo', greatest(balance, 0), g.target_amount - greatest(balance, 0);
  end if;

  insert into public.kitty_withdrawals (group_id, amount, description, withdrawn_by)
  values (g.group_id, g.target_amount, left(btrim(g.title), 200), auth.uid())
  returning id into wid;

  update public.kitty_goals set completed_at = now(), withdrawal_id = wid where id = g.id;
  return wid;
end;
$$;

revoke execute on function public.complete_kitty_goal(uuid) from public, anon;
grant execute on function public.complete_kitty_goal(uuid) to authenticated;
