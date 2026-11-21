-- =====================================================================
-- Treino a Dois: confirmação do pagamento da multa.
--
-- Antes, qualquer membro (inclusive quem devia) marcava a multa como paga.
-- Agora:
--   - quem deve só avisa "Já paguei" (paid_claimed_at); o dinheiro ainda não entra na caixinha;
--   - outro membro confirma o recebimento (paid_at); só então conta como pago;
--   - quem deve não consegue marcar a própria multa como paga nem desfazer uma confirmação.
-- A punição (task_done_at) continua podendo ser marcada por qualquer membro.
-- close_week não muda. A caixinha (app e complete_kitty_goal) já conta só paid_at.
-- =====================================================================

alter table public.week_results
  add column if not exists paid_claimed_at timestamptz;

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
  debtor boolean := p_user_id = auth.uid();
begin
  select * into r from public.week_results where week_id = p_week_id and user_id = p_user_id for update;
  if not found then
    raise exception 'Dívida não encontrada';
  end if;
  if not public.is_member(r.group_id) then
    raise exception 'Você não faz parte deste grupo';
  end if;
  if not r.owes then
    raise exception 'Essa pessoa não deve nada nessa semana';
  end if;

  if p_paid is not null then
    if debtor then
      -- Quem deve só avisa que pagou (ou retira o aviso enquanto ninguém confirmou).
      if r.paid_at is not null then
        raise exception 'O pagamento já foi confirmado. Só quem recebeu pode desfazer' using errcode = 'P0001';
      end if;
      update public.week_results
      set paid_claimed_at = case when p_paid then coalesce(paid_claimed_at, now()) else null end
      where week_id = p_week_id and user_id = p_user_id;
    else
      -- Outro membro confirma o recebimento (ou desfaz: "não recebi").
      update public.week_results
      set paid_at = case when p_paid then coalesce(paid_at, now()) else null end,
          paid_marked_by = case when p_paid then auth.uid() else null end,
          paid_claimed_at = case when p_paid then coalesce(paid_claimed_at, now()) else null end
      where week_id = p_week_id and user_id = p_user_id;
    end if;
  end if;

  if p_task_done is not null then
    update public.week_results
    set task_done_at = case when p_task_done then coalesce(task_done_at, now()) else null end
    where week_id = p_week_id and user_id = p_user_id;
  end if;
end;
$$;
