-- =====================================================================
-- Testes das reações e do tipo de treino (roda depois do 02_location.sql,
-- na mesma sessão: a pessoa a tem um check-in hoje no grupo g).
-- =====================================================================

:as_a
do $$
declare cid uuid;
begin
  select id into cid from public.checkins
  where user_id = test.id('a') and day = public.local_today(test.id('g'));
  assert cid is not null, 'a tem check-in hoje';
  perform set_config('test.cid', cid::text, false);

  -- Reage sem informar grupo nem autor: o banco preenche.
  insert into public.reactions (checkin_id, emoji) values (cid, '🔥');
  assert (select group_id from public.reactions where checkin_id = cid) = test.id('g'), 'grupo vem do check-in';
  assert (select user_id from public.reactions where checkin_id = cid) = test.id('a'), 'autor vem do login';

  -- Uma reação por pessoa e emoji só da lista.
  perform test.expect_error(
    format('insert into public.reactions (checkin_id, emoji) values (%L, ''👏'')', cid), '%one_reaction_per_checkin%');
  perform test.expect_error(
    format('insert into public.reactions (checkin_id, emoji) values (%L, ''🤡'')', cid), '%check constraint%');

  -- Troca o próprio emoji; não consegue mudar mais nada.
  update public.reactions set emoji = '👏' where checkin_id = cid;
  assert (select emoji from public.reactions where checkin_id = cid) = '👏', 'troca o emoji';
  perform test.expect_error(
    format('update public.reactions set checkin_id = gen_random_uuid() where checkin_id = %L', cid), '%permission denied%');
end $$;

:as_b
do $$
declare cid uuid := test.id('cid');
begin
  insert into public.reactions (checkin_id, emoji) values (cid, '💪');
  assert (select count(*) from public.reactions where checkin_id = cid) = 2, 'parceiro vê e cria a sua reação';

  -- Não mexe na reação do outro.
  update public.reactions set emoji = '😍' where user_id = test.id('a');
  delete from public.reactions where user_id = test.id('a');
  assert (select count(*) from public.reactions where checkin_id = cid) = 2, 'não altera nem apaga a do outro';
end $$;

:as_c
do $$
declare cid uuid := test.id('cid');
begin
  assert (select count(*) from public.reactions) = 0, 'quem é de fora não vê reações';
  perform test.expect_error(
    format('insert into public.reactions (checkin_id, emoji) values (%L, ''🔥'')', cid), '%row-level security%');
end $$;

:as_b
do $$
begin
  delete from public.reactions where user_id = test.id('b');
  assert (select count(*) from public.reactions where checkin_id = test.id('cid')) = 1, 'apaga a própria reação';
end $$;

-- Apagar o check-in leva as reações junto. Tipo de treino só aceita os valores da lista.
:as_admin
do $$
begin
  update public.checkins set kind = 'cardio' where id = test.id('cid');
  assert (select kind from public.checkins where id = test.id('cid')) = 'cardio', 'tipo de treino salvo';
  perform test.expect_error(
    format('update public.checkins set kind = ''dormir'' where id = %L', test.id('cid')), '%check constraint%');
  delete from public.checkins where id = test.id('cid');
  assert (select count(*) from public.reactions) = 0, 'reações somem com o check-in';
end $$;

\echo '  reações e tipo de treino passaram'
