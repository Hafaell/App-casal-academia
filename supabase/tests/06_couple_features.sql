-- =====================================================================
-- Testes da leva 2 (roda depois do 05_kitty_goals.sql, na mesma sessão):
-- resposta do parceiro à exceção, roleta de prêmios, planos da semana e "vamos?".
-- a e b estão no grupo g; c é de fora.
-- =====================================================================

-- ---------------------------------------------------------------------
-- F6. Exceção com resposta do parceiro
-- ---------------------------------------------------------------------
:as_a
do $$
declare d date := public.monday_of(public.local_today(test.id('g'))) + 7; -- segunda da semana que vem
begin
  delete from public.exceptions where user_id = test.id('a') and day between d and d + 4;
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), d, 'doenca');
  perform set_config('test.ex1', (select id from public.exceptions where user_id = test.id('a') and day = d)::text, false);
  insert into public.exceptions (group_id, day, reason, note) values (test.id('g'), d + 1, 'viagem', 'Congresso');
  perform set_config('test.ex2', (select id from public.exceptions where user_id = test.id('a') and day = d + 1)::text, false);
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), d + 2, 'lesao');
  perform set_config('test.ex3', (select id from public.exceptions where user_id = test.id('a') and day = d + 2)::text, false);

  perform test.expect_error(format('select public.review_exception(%L, true)', test.id('ex1')), '%quem responde é o seu parceiro%');
  perform test.expect_error(format('update public.exceptions set reviewed_at = now() where id = %L', test.id('ex1')), '%permission denied%');
end $$;

:as_c
do $$
begin
  perform test.expect_error(format('select public.review_exception(%L, false)', test.id('ex1')), '%não encontrada%');
end $$;

:as_b
do $$
begin
  perform public.review_exception(test.id('ex1'), true);
  assert (select reviewed_by from public.exceptions where id = test.id('ex1')) = test.id('b'), 'aprovada pelo parceiro';
  perform test.expect_error(format('select public.review_exception(%L, false)', test.id('ex1')), '%já foi aprovada%');

  perform test.expect_error(format('select public.review_exception(%L, false, %L)', test.id('ex2'), repeat('x', 201)), '%até 200 letras%');
  perform public.review_exception(test.id('ex2'), false, '  Vi você na academia  ');
  assert not exists (select 1 from public.exceptions where id = test.id('ex2')), 'recusada some (deixa de reduzir a meta)';
  assert (select why from public.exception_rejections where exception_id = test.id('ex2')) = 'Vi você na academia', 'motivo sem espaços';
  assert (select note from public.exception_rejections where exception_id = test.id('ex2')) = 'Congresso', 'guarda a observação';
  perform test.expect_error(
    format('insert into public.exception_rejections (group_id, exception_id, day, reason) values (%L, %L, current_date, ''doenca'')',
           test.id('g'), test.id('ex2')),
    '%permission denied%');
end $$;

-- Recusada não pode ser marcada de novo no mesmo dia.
:as_a
do $$
declare d date := public.monday_of(public.local_today(test.id('g'))) + 8;
begin
  perform test.expect_error(
    format('insert into public.exceptions (group_id, day, reason) values (%L, %L, ''doenca'')', test.id('g'), d), '%recusou a exceção desse dia%');
end $$;

-- Prazo: marcada há dois dias, sem resposta, já vale.
:as_admin
update public.exceptions set created_at = now() - interval '2 days' where id = test.id('ex3');

:as_b
do $$
begin
  perform test.expect_error(format('select public.review_exception(%L, false)', test.id('ex3')), '%prazo para responder acabou%');
  assert exists (select 1 from public.exceptions where id = test.id('ex3')), 'continua valendo';
end $$;

:as_a
do $$
begin
  assert (select count(*) from public.exception_rejections where author_id = test.id('a')) = 1, 'o autor vê a recusa';
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.exception_rejections) = 0, 'quem é de fora não vê recusas';
end $$;

:as_admin
delete from public.exceptions where id in (test.id('ex1'), test.id('ex3'));

-- ---------------------------------------------------------------------
-- F3. Roleta de prêmios
-- ---------------------------------------------------------------------
:as_a
do $$
declare gid uuid;
begin
  gid := public.create_group('Prêmios');
  perform set_config('test.pg', gid::text, false);
  assert (select count(*) from public.rewards where group_id = gid) = 6, 'grupo novo começa com 6 prêmios';
  assert (select count(*) from public.rewards where group_id = test.id('g')) = 6, 'grupo antigo também recebe os prêmios';
end $$;

-- Semanas: 05/01 bateu, 12/01 bateu (marco), 19/01 bateu, 26/01 falhou.
:as_admin
do $$
declare wid uuid; ws date;
begin
  foreach ws in array array['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']::date[] loop
    insert into public.weeks (group_id, week_start) values (test.id('pg'), ws) returning id into wid;
    insert into public.week_results (week_id, group_id, user_id, week_start, base_goal, exception_days, goal, checkins, used_joker, met, owes)
    values (wid, test.id('pg'), test.id('a'), ws, 4, 0, 4, 4, false, ws <> '2026-01-26', ws = '2026-01-26');
  end loop;
end $$;

:as_a
do $$
declare s public.reward_spins;
begin
  perform test.expect_error(format('select public.spin_reward(%L, ''2026-01-05'')', test.id('pg')), '%semanas seguidas%');
  perform test.expect_error(format('select public.spin_reward(%L, ''2026-01-19'')', test.id('pg')), '%semanas seguidas%');
  s := public.spin_reward(test.id('pg'), '2026-01-12');
  assert s.reward_text is not null and s.spun_by = test.id('a'), 'giro sorteia um prêmio';
  perform test.expect_error(format('select public.spin_reward(%L, ''2026-01-12'')', test.id('pg')), '%já foi girada%');
  perform test.expect_error(
    format('insert into public.reward_spins (group_id, week_start, reward_text) values (%L, ''2026-01-19'', ''trapaça'')', test.id('pg')),
    '%permission denied%');

  update public.reward_spins set redeemed_at = now() where id = s.id;
  assert (select redeemed_at is not null from public.reward_spins where id = s.id), 'marca como aproveitado';
  perform test.expect_error(format('update public.reward_spins set reward_text = ''outro'' where id = %L', s.id), '%permission denied%');

  update public.rewards set active = false where group_id = test.id('pg');
end $$;

:as_c
do $$
begin
  perform test.expect_error(format('select public.spin_reward(%L, ''2026-01-12'')', test.id('pg')), '%não faz parte%');
  assert (select count(*) from public.rewards) = 0, 'quem é de fora não vê prêmios';
end $$;

:as_admin
delete from public.groups where id = test.id('pg');

-- ---------------------------------------------------------------------
-- F5. Planos da semana e "vamos?"
-- ---------------------------------------------------------------------
:as_a
do $$
declare t date := public.local_today(test.id('g'));
begin
  delete from public.workout_plans where user_id = test.id('a');
  insert into public.workout_plans (group_id, day, period) values (test.id('g'), t, 'manha');
  assert (select user_id from public.workout_plans where group_id = test.id('g') and day = t) = test.id('a'), 'dono vem do login';
  perform test.expect_error(format('insert into public.workout_plans (group_id, day) values (%L, %L)', test.id('g'), t - 1), '%já passou%');
  perform test.expect_error(format('insert into public.workout_plans (group_id, day) values (%L, %L)', test.id('g'), t + 14), '%duas semanas%');
  perform test.expect_error(format('insert into public.workout_plans (group_id, day) values (%L, %L)', test.id('g'), t), '%one_plan_per_day%');
  perform test.expect_error(format('update public.workout_plans set period = ''madrugada'' where user_id = %L', test.id('a')), '%check constraint%');
  update public.workout_plans set period = 'noite' where user_id = test.id('a');

  insert into public.nudges (group_id, to_user) values (test.id('g'), test.id('b'));
  perform test.expect_error(format('insert into public.nudges (group_id, to_user) values (%L, %L)', test.id('g'), test.id('b')), '%meia hora%');
  perform test.expect_error(format('insert into public.nudges (group_id, to_user) values (%L, %L)', test.id('g'), test.id('a')), '%outra pessoa%');
  perform test.expect_error(format('insert into public.nudges (group_id, to_user) values (%L, %L)', test.id('g'), test.id('c')), '%não está no grupo%');
  update public.nudges set seen_at = now() where from_user = test.id('a');
  assert (select seen_at is null from public.nudges where from_user = test.id('a')), 'quem chamou não marca como visto';
end $$;

:as_b
do $$
begin
  assert (select period from public.workout_plans where user_id = test.id('a')) = 'noite', 'parceiro vê o plano';
  delete from public.workout_plans where user_id = test.id('a');
  assert (select count(*) from public.workout_plans where user_id = test.id('a')) = 1, 'não apaga o plano do outro';
  update public.nudges set seen_at = now() where to_user = test.id('b');
  assert (select seen_at is not null from public.nudges where to_user = test.id('b')), 'quem recebeu marca como visto';
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.workout_plans) = 0, 'quem é de fora não vê planos';
  assert (select count(*) from public.nudges) = 0, 'quem é de fora não vê chamadas';
end $$;

:as_admin
delete from public.workout_plans where group_id = test.id('g');
delete from public.nudges where group_id = test.id('g');

\echo '  leva 2 (exceção com resposta, prêmios, planos) passou'
