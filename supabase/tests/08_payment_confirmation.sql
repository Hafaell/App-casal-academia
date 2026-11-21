-- =====================================================================
-- Testes da confirmação do pagamento da multa (roda depois do 07, na mesma sessão).
-- Usa um grupo novo com a e b, e uma semana em que os dois devem.
-- =====================================================================

:as_a
do $$
declare gid uuid;
begin
  gid := public.create_group('Pagamentos');
  perform set_config('test.payg', gid::text, false);
  perform set_config('test.paycode', (select invite_code from public.groups where id = gid), false);
end $$;

:as_b
select public.join_group(current_setting('test.paycode'));

:as_admin
do $$
declare wid uuid;
begin
  insert into public.weeks (group_id, week_start, fine_amount) values (test.id('payg'), '2026-02-02', 30) returning id into wid;
  perform set_config('test.payw', wid::text, false);
  insert into public.week_results (week_id, group_id, user_id, week_start, base_goal, exception_days, goal, checkins, used_joker, met, owes, fine_amount)
  values (wid, test.id('payg'), test.id('a'), '2026-02-02', 4, 0, 4, 1, false, false, true, 30),
         (wid, test.id('payg'), test.id('b'), '2026-02-02', 4, 0, 4, 2, false, false, true, 30);
end $$;

-- Quem deve só avisa; não conta como pago.
:as_a
do $$
begin
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_paid => true);
  assert (select paid_claimed_at is not null and paid_at is null from public.week_results where week_id = test.id('payw') and user_id = test.id('a')),
    'aviso de pagamento sem confirmação';
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_paid => false);
  assert (select paid_claimed_at is null from public.week_results where week_id = test.id('payw') and user_id = test.id('a')), 'retira o aviso';
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_paid => true);
  -- A punição continua podendo ser marcada por quem deve.
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_task_done => true);
  assert (select task_done_at is not null from public.week_results where week_id = test.id('payw') and user_id = test.id('a')), 'punição cumprida';
end $$;

-- O parceiro confirma; aí conta como pago.
:as_b
do $$
begin
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_paid => true);
  assert (select paid_at is not null and paid_marked_by = test.id('b') from public.week_results where week_id = test.id('payw') and user_id = test.id('a')),
    'confirmado por quem recebeu';
  -- Os dois devem: cada um confirma o do outro, ninguém confirma o próprio.
  perform public.set_debt_status(test.id('payw'), test.id('b'), p_paid => true);
  assert (select paid_at is null and paid_claimed_at is not null from public.week_results where week_id = test.id('payw') and user_id = test.id('b')),
    'o próprio só avisa';
end $$;

:as_a
do $$
begin
  perform test.expect_error(format('select public.set_debt_status(%L, %L, false)', test.id('payw'), test.id('a')), '%já foi confirmado%');
  assert (select paid_at is not null from public.week_results where week_id = test.id('payw') and user_id = test.id('a')), 'quem deve não desfaz a confirmação';
  perform public.set_debt_status(test.id('payw'), test.id('b'), p_paid => true);
  assert (select paid_at is not null and paid_marked_by = test.id('a') from public.week_results where week_id = test.id('payw') and user_id = test.id('b')),
    'a confirma o de b';
end $$;

-- Quem recebeu pode desfazer ("não recebi"): volta a dever, sem aviso.
:as_b
do $$
begin
  perform public.set_debt_status(test.id('payw'), test.id('a'), p_paid => false);
  assert (select paid_at is null and paid_claimed_at is null from public.week_results where week_id = test.id('payw') and user_id = test.id('a')), 'não recebi';
end $$;

:as_admin
delete from public.groups where id = test.id('payg');

\echo '  confirmação do pagamento passou'
