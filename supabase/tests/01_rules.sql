-- =====================================================================
-- Testes das regras do banco. Qualquer falha interrompe o psql.
-- =====================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

create schema test;
grant usage on schema test to authenticated;

create function test.expect_error(q text, pattern text default '%')
returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm not ilike pattern then
      raise exception 'Erro inesperado para [%]: % (esperado: %)', q, sqlerrm, pattern;
    end if;
    return;
  end;
  raise exception 'Deveria ter falhado: %', q;
end $$;
grant execute on function test.expect_error(text, text) to authenticated;

create function test.id(k text) returns uuid language sql stable as $$
  select current_setting('test.' || k)::uuid;
$$;
grant execute on function test.id(text) to authenticated;

-- Pessoas: Rafael (a), namorada (b) e alguém de fora (c).
do $$
declare a uuid; b uuid; c uuid;
begin
  insert into auth.users (email, raw_user_meta_data) values ('a@x.com', '{"display_name":"Rafael"}') returning id into a;
  insert into auth.users (email, raw_user_meta_data) values ('b@x.com', '{"display_name":"Bia"}') returning id into b;
  insert into auth.users (email) values ('c@x.com') returning id into c;
  perform set_config('test.a', a::text, false);
  perform set_config('test.b', b::text, false);
  perform set_config('test.c', c::text, false);
  assert (select display_name from public.profiles where id = a) = 'Rafael', 'perfil criado com o nome';
  assert (select display_name from public.profiles where id = c) = 'c', 'perfil sem nome usa o e-mail';
end $$;

\set as_a 'reset role; do $$ begin perform set_config(''request.jwt.claim.sub'', current_setting(''test.a''), false); end $$; set role authenticated;'
\set as_b 'reset role; do $$ begin perform set_config(''request.jwt.claim.sub'', current_setting(''test.b''), false); end $$; set role authenticated;'
\set as_c 'reset role; do $$ begin perform set_config(''request.jwt.claim.sub'', current_setting(''test.c''), false); end $$; set role authenticated;'
\set as_admin 'reset role; do $$ begin perform set_config(''request.jwt.claim.sub'', '''', false); end $$;'

-- ---------------------------------------------------------------------
-- Criar grupo, convite e visibilidade
-- ---------------------------------------------------------------------
:as_a
do $$
declare gid uuid;
begin
  gid := public.create_group('Casal');
  perform set_config('test.g', gid::text, false);
  assert (select count(*) from public.punishments where group_id = gid) = 8, 'roleta inicial com 8 punições';
  assert (select weekly_goal from public.groups where id = gid) = 4, 'meta padrão 4';
  assert (select extract(isodow from starts_on) from public.groups where id = gid) = 1, 'grupo começa numa segunda';
  assert (select starts_on >= public.monday_of(public.local_today(gid)) from public.groups where id = gid), 'grupo começa nesta semana ou na próxima';
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.groups) = 0, 'quem é de fora não vê o grupo';
  perform test.expect_error('select public.join_group(''XXXXXX'')', '%convite inválido%');
  perform test.expect_error(format('select public.catch_up_weeks(%L)', test.id('g')), '%não faz parte%');
end $$;

:as_b
do $$
declare code text;
begin
  assert (select count(*) from public.groups) = 0, 'antes de entrar, não vê nada';
end $$;
:as_admin
do $$ begin perform set_config('test.code', (select invite_code from public.groups where id = test.id('g')), false); end $$;
:as_b
do $$
begin
  perform public.join_group(lower(current_setting('test.code')));
  assert (select count(*) from public.group_members where group_id = test.id('g')) = 2, 'dois membros';
  assert (select display_name from public.profiles where id = test.id('a')) = 'Rafael', 'vê o perfil do parceiro';
  assert (select count(*) from public.profiles where id = test.id('c')) = 0, 'não vê perfil de fora';
end $$;

-- ---------------------------------------------------------------------
-- Permissões de escrita
-- ---------------------------------------------------------------------
:as_a
do $$
begin
  update public.groups set weekly_goal = 5 where id = test.id('g');
  assert (select weekly_goal from public.groups where id = test.id('g')) = 5, 'membro edita a meta';
  update public.groups set weekly_goal = 4 where id = test.id('g');
  perform test.expect_error(format('update public.groups set starts_on = ''2020-01-06'' where id = %L', test.id('g')), '%permission denied%');
  perform test.expect_error(format('update public.groups set fine_min = 60 where id = %L', test.id('g')), '%fine_range%');
  perform test.expect_error('insert into public.weeks (group_id, week_start) values (test.id(''g''), ''2026-10-05'')', '%permission denied%');
  perform test.expect_error(format('select public.close_week(%L, ''2026-10-05'')', test.id('g')), '%permission denied%');
  perform test.expect_error('select public.close_due_weeks()', '%permission denied%');
  update public.profiles set display_name = 'X' where id = test.id('b');
  assert (select display_name from public.profiles where id = test.id('b')) = 'Bia', 'não edita o perfil do outro';
end $$;

-- ---------------------------------------------------------------------
-- Check-in de hoje (data sempre do servidor)
-- ---------------------------------------------------------------------
:as_a
do $$
declare
  today date := public.local_today(test.id('g'));
  path text := test.id('g') || '/' || test.id('a') || '/foto.jpg';
begin
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path) values (%L, %L)', test.id('g'), test.id('g') || '/' || test.id('b') || '/x.jpg'),
    '%inválido%');

  if extract(isodow from today) = 7 then
    perform test.expect_error(
      format('insert into public.checkins (group_id, photo_path) values (%L, %L)', test.id('g'), path), '%Domingo%');
  else
    insert into public.checkins (group_id, photo_path, day, created_at)
    values (test.id('g'), path, '2000-01-01', '2000-01-01');
    assert (select day from public.checkins where user_id = test.id('a')) = today, 'dia vem do servidor';
    assert (select created_at::date from public.checkins where user_id = test.id('a')) > '2000-01-01', 'hora vem do servidor';
    perform test.expect_error(
      format('insert into public.checkins (group_id, photo_path) values (%L, %L)', test.id('g'), path), '%já registrou%');
    -- Exceção num dia em que já treinou não é aceita.
    if extract(isodow from today) <= 5 then
      perform test.expect_error(
        format('insert into public.exceptions (group_id, day, reason) values (%L, %L, ''viagem'')', test.id('g'), today), '%já treinou%');
    end if;
  end if;
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.checkins) = 0, 'quem é de fora não vê check-ins';
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path) values (%L, %L)', test.id('g'), test.id('g') || '/' || test.id('c') || '/x.jpg'),
    '%row-level security%');
end $$;

-- ---------------------------------------------------------------------
-- Exceções e coringa (semana atual)
-- ---------------------------------------------------------------------
:as_b
do $$
declare
  today date := public.local_today(test.id('g'));
  mon date := public.monday_of(today);
begin
  perform test.expect_error(
    format('insert into public.exceptions (group_id, day, reason) values (%L, %L, ''doenca'')', test.id('g'), mon + 5), '%segunda a sexta%');
  perform test.expect_error(
    format('insert into public.exceptions (group_id, day, reason) values (%L, %L, ''doenca'')', test.id('g'), mon - 3), '%semana atual%');
  insert into public.exceptions (group_id, day, reason) values (test.id('g'), mon + 7, 'viagem');
  assert (select count(*) from public.exceptions where user_id = test.id('b')) = 1, 'exceção futura aceita';

  perform test.expect_error(
    format('insert into public.jokers (group_id, week_start) values (%L, %L)', test.id('g'), mon - 7), '%semana atual%');
  insert into public.jokers (group_id, week_start) values (test.id('g'), mon);
  perform test.expect_error(
    format('insert into public.jokers (group_id, week_start) values (%L, %L)', test.id('g'), mon), '%');
  delete from public.jokers where user_id = test.id('b');
  assert (select count(*) from public.jokers) = 0, 'pode desfazer o coringa da semana aberta';
end $$;

-- ---------------------------------------------------------------------
-- Fechamento de semanas passadas
-- Montamos um histórico a partir de 05/10/2026 (segunda) como administrador.
-- ---------------------------------------------------------------------
:as_admin
update public.groups set starts_on = '2026-10-05' where id = test.id('g');
update public.group_members set starts_on = '2026-10-05' where group_id = test.id('g');
delete from public.checkins;
delete from public.exceptions;

set session_replication_role = replica; -- desliga gatilhos para gravar o passado
insert into public.checkins (group_id, user_id, day, photo_path)
select test.id('g'), test.id(u), d::date, test.id('g') || '/' || test.id(u) || '/' || d || '.jpg'
from (values
  -- Semana 1 (05/10): Rafael 4 treinos; Bia 2 treinos + 2 exceções.
  ('a', '2026-10-05'), ('a', '2026-10-06'), ('a', '2026-10-07'), ('a', '2026-10-08'),
  ('b', '2026-10-05'), ('b', '2026-10-06'),
  -- Semana 2 (12/10): os dois falham. Domingo do Rafael não conta.
  ('a', '2026-10-12'), ('a', '2026-10-13'), ('a', '2026-10-14'), ('a', '2026-10-18'),
  ('b', '2026-10-12'),
  -- Semana 3 (19/10): Rafael falha mas usa coringa; Bia bate a meta com sábado.
  ('a', '2026-10-19'), ('a', '2026-10-20'), ('a', '2026-10-21'),
  ('b', '2026-10-19'), ('b', '2026-10-20'), ('b', '2026-10-21'), ('b', '2026-10-24'),
  -- Semana 4 (26/10): Bia marca exceção num dia em que treinou (não reduz a meta).
  ('a', '2026-10-26'), ('a', '2026-10-27'), ('a', '2026-10-28'), ('a', '2026-10-29'),
  ('b', '2026-10-26'), ('b', '2026-10-27'), ('b', '2026-10-28')
) as v(u, d);
insert into public.exceptions (group_id, user_id, day, reason) values
  (test.id('g'), test.id('b'), '2026-10-07', 'menstruacao'),
  (test.id('g'), test.id('b'), '2026-10-08', 'menstruacao'),
  (test.id('g'), test.id('b'), '2026-10-26', 'doenca');
insert into public.jokers (group_id, user_id, week_start) values (test.id('g'), test.id('a'), '2026-10-19');
set session_replication_role = origin;

do $$
declare
  w1 uuid; w2 uuid; w3 uuid; w4 uuid;
  r record;
begin
  w1 := public.close_week(test.id('g'), '2026-10-05');
  w2 := public.close_week(test.id('g'), '2026-10-12');
  w3 := public.close_week(test.id('g'), '2026-10-19');
  w4 := public.close_week(test.id('g'), '2026-10-26');
  assert public.close_week(test.id('g'), '2026-10-05') is null, 'fechar de novo não faz nada';

  -- Semana 1
  select * into r from public.week_results where week_id = w1 and user_id = test.id('b');
  assert r.goal = 2 and r.exception_days = 2 and r.checkins = 2 and r.met and not r.owes, 'exceções reduzem a meta';
  assert (select fine_amount from public.weeks where id = w1) is null, 'ninguém falhou, sem sorteio';

  -- Semana 2
  select * into r from public.week_results where week_id = w2 and user_id = test.id('a');
  assert r.checkins = 3 and r.owes, 'domingo não conta';
  assert (select count(*) from public.week_results where week_id = w2 and owes) = 2, 'os dois devem';
  assert (select count(distinct fine_amount) from public.week_results where week_id = w2) = 1, 'mesma multa para os dois';
  assert (select count(distinct punishment_text) from public.week_results where week_id = w2) = 1, 'mesma tarefa para os dois';
  assert (select fine_amount between 10 and 50 from public.weeks where id = w2), 'multa entre 10 e 50';
  assert (select punishment_text is not null from public.weeks where id = w2), 'punição sorteada da roleta';

  -- Semana 3
  select * into r from public.week_results where week_id = w3 and user_id = test.id('a');
  assert r.used_joker and not r.met and not r.owes and r.fine_amount = 0, 'coringa cancela a punição';
  select * into r from public.week_results where week_id = w3 and user_id = test.id('b');
  assert r.met and r.checkins = 4, 'sábado conta';

  -- Semana 4
  select * into r from public.week_results where week_id = w4 and user_id = test.id('b');
  assert r.exception_days = 0 and r.goal = 4 and r.owes, 'exceção em dia treinado não reduz a meta';
  assert (select count(*) from public.week_results where week_id = w4 and owes) = 1, 'só uma pessoa deve';
end $$;

-- Semanas vencidas restantes são fechadas até a última que terminou.
do $$
declare
  n int;
  last_due date := public.monday_of(public.local_today(test.id('g'))) - 7;
begin
  n := public.close_due_weeks(test.id('g'));
  assert n = (last_due - date '2026-11-02') / 7 + 1, format('fechou %s semanas', n);
  assert (select max(week_start) from public.weeks where group_id = test.id('g')) = last_due, 'última semana fechada';
  assert public.close_due_weeks(test.id('g')) = 0, 'nada mais a fechar';
end $$;

-- ---------------------------------------------------------------------
-- Semana fechada é imutável; caixinha
-- ---------------------------------------------------------------------
:as_a
do $$
declare w2 uuid := (select id from public.weeks where group_id = test.id('g') and week_start = '2026-10-12');
begin
  perform test.expect_error('delete from public.checkins where day = ''2026-10-05''', '%já foi fechada%');
  perform test.expect_error(format('update public.week_results set paid_at = now() where week_id = %L', w2), '%permission denied%');

  perform public.set_debt_status(w2, test.id('b'), p_paid => true);
  assert (select paid_at is not null and paid_marked_by = test.id('a') from public.week_results where week_id = w2 and user_id = test.id('b')), 'multa marcada como paga';
  perform public.set_debt_status(w2, test.id('b'), p_task_done => true);
  assert (select paid_at is not null and task_done_at is not null from public.week_results where week_id = w2 and user_id = test.id('b')), 'tarefa cumprida mantém o pagamento';
  perform public.set_debt_status(w2, test.id('b'), p_paid => false);
  assert (select paid_at is null from public.week_results where week_id = w2 and user_id = test.id('b')), 'pode desmarcar';

  perform test.expect_error(
    format('select public.set_debt_status(%L, %L, true)', (select id from public.weeks where week_start = '2026-10-05'), test.id('a')),
    '%não deve nada%');
end $$;

:as_c
do $$
begin
  perform test.expect_error(
    format('select public.set_debt_status(%L, %L, true)', (select id from public.weeks where week_start = '2026-10-12' limit 1), test.id('b')),
    '%não encontrada%');
  assert (select count(*) from public.week_results) = 0, 'quem é de fora não vê resultados';
end $$;

-- ---------------------------------------------------------------------
-- Quem entra no meio da semana só tem meta a partir da próxima segunda
-- ---------------------------------------------------------------------
:as_c
do $$
declare
  mon date;
  gid uuid := public.join_group(current_setting('test.code'));
begin
  mon := public.monday_of(public.local_today(gid));
  assert (select starts_on from public.group_members where group_id = gid and user_id = test.id('c'))
         = case when public.local_today(gid) = mon then mon else mon + 7 end, 'meta começa na próxima segunda';
end $$;

-- ---------------------------------------------------------------------
-- Fotos no Storage
-- ---------------------------------------------------------------------
:as_a
do $$
begin
  insert into storage.objects (bucket_id, name) values ('checkins', test.id('g') || '/' || test.id('a') || '/1.jpg');
  perform test.expect_error(
    format('insert into storage.objects (bucket_id, name) values (''checkins'', %L)', test.id('g') || '/' || test.id('b') || '/1.jpg'),
    '%row-level security%');
  perform test.expect_error(
    'insert into storage.objects (bucket_id, name) values (''checkins'', ''nao-e-uuid/x/1.jpg'')',
    '%row-level security%');
end $$;

:as_b
do $$
begin
  assert (select count(*) from storage.objects) = 1, 'parceiro vê a foto';
  delete from storage.objects;
  assert (select count(*) from storage.objects) = 1, 'não apaga foto do outro';
end $$;

:as_admin
do $$
begin
  delete from public.group_members where user_id = test.id('c');
end $$;
:as_c
do $$
begin
  assert (select count(*) from storage.objects) = 0, 'quem é de fora não vê fotos';
end $$;

\echo '  todas as regras do banco passaram'
