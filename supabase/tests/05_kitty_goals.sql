-- =====================================================================
-- Testes da caixinha com objetivo (roda depois do 04_reports.sql,
-- na mesma sessão). Usa um grupo novo, só da pessoa a, para o saldo começar do zero.
-- =====================================================================

:as_a
do $$
declare gid uuid;
begin
  gid := public.create_group('Caixinha');
  perform set_config('test.kg', gid::text, false);

  -- Um objetivo aberto por vez; não dá para criar já concluído.
  insert into public.kitty_goals (group_id, title, target_amount) values (gid, 'Viagem', 80);
  assert (select created_by from public.kitty_goals where group_id = gid) = test.id('a'), 'autor vem do login';
  perform test.expect_error(
    format('insert into public.kitty_goals (group_id, title, target_amount) values (%L, ''Outro'', 10)', gid), '%kitty_goals_one_open%');
  perform test.expect_error(
    format('insert into public.kitty_goals (group_id, title, target_amount, completed_at) values (%L, ''X'', 10, now())', gid), '%permission denied%');
  perform test.expect_error(
    format('update public.kitty_goals set completed_at = now() where group_id = %L', gid), '%permission denied%');
  perform test.expect_error(
    format('insert into public.kitty_goals (group_id, title, target_amount) values (%L, ''   '', 10)', gid), '%check constraint%');

  update public.kitty_goals set title = 'Viagem para a praia' where group_id = gid;
  perform set_config('test.goal', (select id from public.kitty_goals where group_id = gid)::text, false);

  -- Sem saldo, não conclui.
  perform test.expect_error(format('select public.complete_kitty_goal(%L)', test.id('goal')), '%falta R$ 80%');
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.kitty_goals) = 0, 'quem é de fora não vê objetivos';
  perform test.expect_error(format('select public.complete_kitty_goal(%L)', test.id('goal')), '%não encontrado%');
  perform test.expect_error(
    format('insert into public.kitty_goals (group_id, title, target_amount) values (%L, ''Invasão'', 10)', test.id('kg')), '%row-level security%');
end $$;

-- Duas multas pagas (R$ 50 + R$ 40) e uma não paga: saldo de R$ 90.
:as_admin
do $$
declare w1 uuid; w2 uuid;
begin
  insert into public.weeks (group_id, week_start) values (test.id('kg'), '2026-01-05') returning id into w1;
  insert into public.weeks (group_id, week_start) values (test.id('kg'), '2026-01-12') returning id into w2;
  insert into public.week_results (week_id, group_id, user_id, week_start, base_goal, exception_days, goal, checkins, used_joker, met, owes, fine_amount, paid_at)
  values (w1, test.id('kg'), test.id('a'), '2026-01-05', 4, 0, 4, 1, false, false, true, 50, now()),
         (w2, test.id('kg'), test.id('a'), '2026-01-12', 4, 0, 4, 2, false, false, true, 40, now());
  insert into public.weeks (group_id, week_start) values (test.id('kg'), '2026-01-19') returning id into w1;
  insert into public.week_results (week_id, group_id, user_id, week_start, base_goal, exception_days, goal, checkins, used_joker, met, owes, fine_amount)
  values (w1, test.id('kg'), test.id('a'), '2026-01-19', 4, 0, 4, 0, false, false, true, 30);
end $$;

:as_a
do $$
declare wid uuid;
begin
  wid := public.complete_kitty_goal(test.id('goal'));
  assert (select amount from public.kitty_withdrawals where id = wid) = 80, 'retirada do valor do objetivo';
  assert (select description from public.kitty_withdrawals where id = wid) = 'Viagem para a praia', 'retirada com o nome do objetivo';
  assert (select completed_at is not null from public.kitty_goals where id = test.id('goal')), 'objetivo concluído';
  assert (select withdrawal_id from public.kitty_goals where id = test.id('goal')) = wid, 'objetivo aponta a retirada';
  perform test.expect_error(format('select public.complete_kitty_goal(%L)', test.id('goal')), '%já foi concluído%');

  -- Concluído o anterior, dá para abrir outro. Sobram R$ 10: não conclui um de R$ 20.
  insert into public.kitty_goals (group_id, title, target_amount) values (test.id('kg'), 'Jantar', 20);
  perform test.expect_error(
    format('select public.complete_kitty_goal((select id from public.kitty_goals where group_id = %L and completed_at is null))', test.id('kg')),
    '%tem R$ 10, falta R$ 10%');

  delete from public.kitty_goals where group_id = test.id('kg') and completed_at is null;
  assert (select count(*) from public.kitty_goals where group_id = test.id('kg')) = 1, 'apaga o objetivo aberto';
end $$;

:as_admin
delete from public.groups where id = test.id('kg');

\echo '  caixinha com objetivo passou'
