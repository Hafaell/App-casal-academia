-- =====================================================================
-- Testes de "reportar check-in" (roda depois do 03_reactions.sql, na mesma sessão).
-- No fim do 03 o check-in de hoje da pessoa a foi apagado e a regra de localização está desligada.
-- =====================================================================

:as_a
do $$
declare cid uuid;
begin
  insert into public.checkins (group_id, photo_path)
  values (test.id('g'), test.id('g') || '/' || test.id('a') || '/reportada.jpg');
  select id into cid from public.checkins where user_id = test.id('a') and day = public.local_today(test.id('g'));
  perform set_config('test.rid', cid::text, false);

  perform test.expect_error(format('select public.report_checkin(%L, ''foto errada'')', cid), '%próprio treino%');
end $$;

:as_c
do $$
begin
  perform test.expect_error(format('select public.report_checkin(%L, ''foto errada'')', test.id('rid')), '%não encontrado%');
end $$;

:as_b
do $$
begin
  perform test.expect_error(format('select public.report_checkin(%L, ''   '')', test.id('rid')), '%Escreva o motivo%');
  perform test.expect_error(format('select public.report_checkin(%L, %L)', test.id('rid'), repeat('x', 201)), '%Escreva o motivo%');
  -- Escrita direta na tabela de reports não existe.
  perform test.expect_error(
    format('insert into public.checkin_reports (group_id, checkin_id, day, reason, photo_path) values (%L, %L, current_date, ''x'', ''y'')',
           test.id('g'), test.id('rid')),
    '%permission denied%');

  perform public.report_checkin(test.id('rid'), '  Foto tirada em casa  ');
  assert not exists (select 1 from public.checkins where id = test.id('rid')), 'check-in cancelado some';
  assert (select count(*) from public.checkin_reports) = 1, 'fica o registro do report';
  assert (select reason from public.checkin_reports) = 'Foto tirada em casa', 'motivo sem espaços';
  assert (select author_id from public.checkin_reports) = test.id('a'), 'autor do treino';
  assert (select reporter_id from public.checkin_reports) = test.id('b'), 'quem reportou vem do login';
  perform test.expect_error(format('select public.report_checkin(%L, ''de novo'')', test.id('rid')), '%não encontrado%');
end $$;

:as_a
do $$
begin
  assert (select count(*) from public.checkin_reports) = 1, 'o autor vê que foi reportado';
  -- Depois de cancelado, o dia fica livre para um novo check-in.
  insert into public.checkins (group_id, photo_path)
  values (test.id('g'), test.id('g') || '/' || test.id('a') || '/nova.jpg');
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.checkin_reports) = 0, 'quem é de fora não vê reports';
end $$;

-- Semana fechada não aceita report.
:as_admin
insert into public.weeks (group_id, week_start)
values (test.id('g'), public.monday_of(public.local_today(test.id('g'))));

:as_b
do $$
begin
  perform test.expect_error(
    format('select public.report_checkin((select id from public.checkins where user_id = %L and day = public.local_today(%L)), ''tarde demais'')',
           test.id('a'), test.id('g')),
    '%já foi fechada%');
end $$;

:as_admin
delete from public.weeks where group_id = test.id('g') and week_start = public.monday_of(public.local_today(test.id('g')));

\echo '  reports de check-in passaram'
