-- ---------------------------------------------------------------------
-- Retiradas da caixinha
-- ---------------------------------------------------------------------

create table public.kitty_withdrawals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  amount int not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 200),
  withdrawn_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index kitty_withdrawals_group_idx on public.kitty_withdrawals (group_id, created_at desc);

-- RLS: apenas membros do grupo podem ver e inserir retiradas
alter table public.kitty_withdrawals enable row level security;

create policy "members can read withdrawals"
  on public.kitty_withdrawals for select
  using (public.is_member(group_id));

create policy "members can insert withdrawals"
  on public.kitty_withdrawals for insert
  with check (public.is_member(group_id));

create policy "members can delete own withdrawals"
  on public.kitty_withdrawals for delete
  using (public.is_member(group_id) and withdrawn_by = auth.uid());
