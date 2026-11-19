-- =====================================================================
-- Treino a Dois: reportar o check-in de outro membro.
-- A regra do GPS decide se a pessoa pode tirar a foto. Se alguém burlar, outro membro
-- vê a foto no feed e reporta: o treino é cancelado (deixa de contar na meta) e fica um
-- registro público no grupo com quem reportou e o motivo.
-- Cancelar = apagar o check-in. Assim close_week, o placar e a sequência continuam iguais.
-- =====================================================================

create table public.checkin_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- Sem chave estrangeira: o check-in é apagado ao ser reportado.
  checkin_id uuid not null,
  author_id uuid references auth.users (id) on delete set null,
  reporter_id uuid references auth.users (id) on delete set null,
  day date not null,
  reason text not null check (char_length(reason) between 1 and 200),
  -- Guardados para o feed mostrar a foto cancelada e a academia.
  photo_path text not null,
  gym_name text,
  distance_m int,
  created_at timestamptz not null default now()
);

create index checkin_reports_group_idx on public.checkin_reports (group_id, created_at desc);

alter table public.checkin_reports enable row level security;

create policy checkin_reports_select on public.checkin_reports for select to authenticated
  using (public.is_member(group_id));

-- Só a função abaixo escreve nesta tabela.
revoke all on public.checkin_reports from anon;
revoke insert, update, delete on public.checkin_reports from authenticated;

create or replace function public.report_checkin(p_checkin uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.checkins;
  why text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'Faça login para reportar um treino';
  end if;

  select * into c from public.checkins where id = p_checkin;
  -- Quem não é do grupo recebe a mesma resposta de um check-in que não existe.
  if not found or not public.is_member(c.group_id) then
    raise exception 'Check-in não encontrado';
  end if;

  if c.user_id = auth.uid() then
    raise exception 'Você não pode reportar o seu próprio treino. Use Apagar no feed' using errcode = 'P0001';
  end if;

  if char_length(why) not between 1 and 200 then
    raise exception 'Escreva o motivo (até 200 letras)' using errcode = 'P0001';
  end if;

  -- Semana fechada já virou multa e caixinha: não dá para mudar depois.
  if exists (select 1 from public.weeks w
             where w.group_id = c.group_id and w.week_start = public.monday_of(c.day)) then
    raise exception 'Essa semana já foi fechada. Não dá mais para cancelar este treino' using errcode = 'P0001';
  end if;

  insert into public.checkin_reports (group_id, checkin_id, author_id, reporter_id, day, reason, photo_path, gym_name, distance_m)
  values (c.group_id, c.id, c.user_id, auth.uid(), c.day, why, c.photo_path, c.gym_name, c.distance_m);

  delete from public.checkins where id = c.id;
end;
$$;

revoke execute on function public.report_checkin(uuid, text) from public, anon;
grant execute on function public.report_checkin(uuid, text) to authenticated;
