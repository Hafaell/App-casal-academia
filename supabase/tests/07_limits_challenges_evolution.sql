-- =====================================================================
-- Testes da leva 3 (roda depois do 06, na mesma sessão): limite mensal de exceções,
-- desafios do mês e fotos de evolução. a e b estão no grupo g; c é de fora.
-- No fim do 04 a regra de localização do grupo g está desligada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 7. Limite mensal de exceções
-- ---------------------------------------------------------------------
:as_admin
do $$
declare
  m date := (date_trunc('month', public.local_today(test.id('g'))) + interval '1 month')::date;
  d date := m + ((8 - extract(isodow from m)::int) % 7); -- primeira segunda do mês que vem
begin
  perform set_config('test.lim_day', d::text, false);
  update public.groups set exceptions_per_month = 2 where id = test.id('g');
end $$;

:as_a
do $$
declare d date := current_setting('test.lim_day')::date;
begin
  delete from public.exceptions where user_id = test.id('a') and date_trunc('month', day) = date_trunc('month', d);
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), d, 'viagem');
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), d + 1, 'viagem');
  perform test.expect_error(
    format('insert into public.exceptions (group_id, day, reason) values (%L, %L, ''viagem'')', test.id('g'), d + 2), '%usou as 2 exceções deste mês%');
  perform set_config('test.lim_ex', (select id from public.exceptions where user_id = test.id('a') and day = d)::text, false);
end $$;

-- Recusada some e libera a vaga do mês (mas o próprio dia recusado não pode voltar).
:as_b
select public.review_exception(test.id('lim_ex'), false);

:as_a
do $$
declare d date := current_setting('test.lim_day')::date;
begin
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), d + 2, 'viagem');
  assert (select count(*) from public.exceptions where user_id = test.id('a') and date_trunc('month', day) = date_trunc('month', d)) = 2, 'vaga liberada';
  perform test.expect_error(format('update public.groups set exceptions_per_month = 0 where id = %L', test.id('g')), '%check constraint%');
end $$;

:as_admin
do $$
begin
  delete from public.exceptions where group_id = test.id('g') and day >= current_setting('test.lim_day')::date;
  delete from public.exception_rejections where group_id = test.id('g');
  update public.groups set exceptions_per_month = 4 where id = test.id('g');
end $$;

-- ---------------------------------------------------------------------
-- 9. Desafios do mês
-- ---------------------------------------------------------------------
:as_a
do $$
declare
  m date := date_trunc('month', public.local_today(test.id('g')))::date;
  cid uuid;
begin
  insert into public.monthly_challenges (group_id, month, title, kind, target) values (test.id('g'), m, 'Mês do cardio', 'cardio', 2);
  select id into cid from public.monthly_challenges where group_id = test.id('g') and month = m;
  perform set_config('test.ch', cid::text, false);
  assert (select created_by from public.monthly_challenges where id = cid) = test.id('a'), 'autor vem do login';
  perform test.expect_error(
    format('insert into public.monthly_challenges (group_id, month, title, kind, target) values (%L, %L, ''X'', ''total'', 5)', test.id('g'), m),
    '%one_challenge_per_month%');
  perform test.expect_error(
    format('insert into public.monthly_challenges (group_id, month, title, kind, target) values (%L, %L, ''X'', ''total'', 5)',
           test.id('g'), (m + interval '3 months')::date),
    '%este mês ou para o próximo%');
  perform test.expect_error(
    format('insert into public.monthly_challenges (group_id, month, title, kind, target) values (%L, %L, ''X'', ''nadar'', 5)',
           test.id('g'), (m + interval '1 month')::date),
    '%check constraint%');
  perform test.expect_error(format('select public.spin_challenge_reward(%L)', cid), '%ainda não foi cumprido%');
end $$;

-- a e b treinaram hoje, perto e na mesma hora: 1 de cardio (a) e 1 treino junto.
:as_b
do $$
begin
  delete from public.checkins where user_id = test.id('b') and day = public.local_today(test.id('g'));
  insert into public.checkins (group_id, photo_path) values (test.id('g'), test.id('g') || '/' || test.id('b') || '/desafio.jpg');
end $$;

:as_admin
do $$
declare t date := public.local_today(test.id('g'));
begin
  update public.checkins set lat = -20.6711, lng = -40.4997, created_at = now()
  where group_id = test.id('g') and day = t and user_id in (test.id('a'), test.id('b'));
  update public.checkins set kind = 'cardio' where group_id = test.id('g') and day = t and user_id = test.id('a');
  update public.checkins set kind = 'musculacao', lat = -20.6721 where group_id = test.id('g') and day = t and user_id = test.id('b'); -- ~110 m
end $$;

:as_a
do $$
begin
  assert public.challenge_progress(test.id('ch')) = 1, 'um treino de cardio';
  update public.monthly_challenges set kind = 'juntos' where id = test.id('ch');
  assert public.challenge_progress(test.id('ch')) = 1, 'um dia de treino a dois';
  update public.monthly_challenges set kind = 'total' where id = test.id('ch');
  assert public.challenge_progress(test.id('ch')) = 2, 'dois treinos somados';
end $$;

-- Longe (~1,1 km): não é treino a dois.
:as_admin
update public.checkins set lat = -20.6811 where group_id = test.id('g') and day = public.local_today(test.id('g')) and user_id = test.id('b');

:as_a
do $$
begin
  update public.monthly_challenges set kind = 'juntos' where id = test.id('ch');
  assert public.challenge_progress(test.id('ch')) = 0, 'longe não conta como juntos';
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.monthly_challenges) = 0, 'quem é de fora não vê desafios';
  assert public.challenge_progress(test.id('ch')) = 0, 'quem é de fora não vê o progresso';
  perform test.expect_error(format('select public.spin_challenge_reward(%L)', test.id('ch')), '%não encontrado%');
end $$;

-- Cumprido: gira uma vez só e o desafio fica travado.
:as_a
do $$
declare s public.reward_spins;
begin
  update public.monthly_challenges set kind = 'cardio', target = 1 where id = test.id('ch');
  s := public.spin_challenge_reward(test.id('ch'));
  assert s.challenge_id = test.id('ch') and s.week_start is null and s.reward_text is not null, 'giro extra do desafio';
  perform test.expect_error(format('select public.spin_challenge_reward(%L)', test.id('ch')), '%já foi usado%');
  perform test.expect_error(format('update public.monthly_challenges set target = 5 where id = %L', test.id('ch')), '%não pode mais ser mudado%');
  perform test.expect_error(format('delete from public.monthly_challenges where id = %L', test.id('ch')), '%não pode mais ser mudado%');
end $$;

:as_admin
delete from public.reward_spins where challenge_id = test.id('ch');
delete from public.monthly_challenges where group_id = test.id('g');

-- ---------------------------------------------------------------------
-- 11. Fotos de evolução
-- ---------------------------------------------------------------------
:as_a
do $$
declare p text := test.id('a') || '/antes.jpg';
begin
  insert into public.evolution_photos (group_id, photo_path, taken_on, weight_kg) values (test.id('g'), p, public.local_today(test.id('g')), 72.5);
  assert (select user_id from public.evolution_photos where photo_path = p) = test.id('a'), 'dono vem do login';
  perform test.expect_error(
    format('insert into public.evolution_photos (group_id, photo_path, taken_on) values (%L, %L, %L)',
           test.id('g'), test.id('b') || '/x.jpg', public.local_today(test.id('g'))),
    '%Caminho da foto inválido%');
  perform test.expect_error(
    format('insert into public.evolution_photos (group_id, photo_path, taken_on) values (%L, %L, %L)',
           test.id('g'), test.id('a') || '/futuro.jpg', public.local_today(test.id('g')) + 1),
    '%futuro%');
  assert public.can_read_evolution_photo(p), 'dono lê a própria foto';
end $$;

:as_b
do $$
declare p text := test.id('a') || '/antes.jpg';
begin
  assert (select count(*) from public.evolution_photos) = 0, 'parceiro não vê foto privada';
  assert not public.can_read_evolution_photo(p), 'nem o arquivo';
end $$;

:as_a
update public.evolution_photos set shared = true where user_id = test.id('a');

:as_b
do $$
declare p text := test.id('a') || '/antes.jpg';
begin
  assert (select count(*) from public.evolution_photos) = 1, 'parceiro vê a foto compartilhada';
  assert public.can_read_evolution_photo(p), 'e o arquivo';
  update public.evolution_photos set weight_kg = 50 where photo_path = p;
  delete from public.evolution_photos where photo_path = p;
  assert (select weight_kg from public.evolution_photos where photo_path = p) = 72.5, 'não altera nem apaga a foto do outro';
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.evolution_photos) = 0, 'quem é de fora não vê';
  assert not public.can_read_evolution_photo(test.id('a') || '/antes.jpg'), 'nem o arquivo';
end $$;

:as_a
delete from public.evolution_photos where user_id = test.id('a');

\echo '  leva 3 (limite de exceções, desafios, fotos de evolução) passou'
