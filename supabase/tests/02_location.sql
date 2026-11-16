-- =====================================================================
-- Testes da verificação de localização (roda depois do 01_rules.sql,
-- na mesma sessão, reaproveitando as pessoas a, b, c e o grupo g).
-- =====================================================================

:as_admin
-- Garante um dia que aceita check-in e liga a exigência de localização.
update public.groups set require_location = true, sunday_counts = true where id = test.id('g');
delete from public.checkins where day = public.local_today(test.id('g'));

do $$
begin
  -- 1 grau de latitude tem cerca de 111,2 km.
  assert abs(public.distance_m(-23.55, -46.63, -23.55, -46.63)) < 0.001, 'distância zero';
  assert abs(public.distance_m(-23.55, -46.63, -22.55, -46.63) - 111195) < 50, '1 grau de latitude';
end $$;

-- ---------------------------------------------------------------------
-- Sem academia cadastrada
-- ---------------------------------------------------------------------
:as_a
do $$
declare path text := test.id('g') || '/' || test.id('a') || '/loc1.jpg';
begin
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path) values (%L, %L)', test.id('g'), path),
    '%Ative a localização%');
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path, lat, lng) values (%L, %L, -23.55, -46.63)', test.id('g'), path),
    '%Cadastre a academia%');
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path, lat) values (%L, %L, -23.55)', test.id('g'), path),
    '%incompleta%');

  -- Cadastra a academia (em São Paulo, -23.5505, -46.6333).
  insert into public.gyms (group_id, name, address, place_id, lat, lng)
  values (test.id('g'), '  Smart Fit Centro ', 'Rua X, 100', 'abc', -23.5505, -46.6333);
  assert (select name from public.gyms where group_id = test.id('g')) = 'Smart Fit Centro', 'nome sem espaços';
  assert (select created_by from public.gyms where group_id = test.id('g')) = test.id('a'), 'autor vem do login';
  perform set_config('test.gym', (select id::text from public.gyms where group_id = test.id('g')), false);
end $$;

-- ---------------------------------------------------------------------
-- Longe, sinal fraco e dentro do raio
-- ---------------------------------------------------------------------
:as_a
do $$
declare
  path text := test.id('g') || '/' || test.id('a') || '/loc2.jpg';
  c public.checkins;
begin
  -- Cerca de 1 km ao norte: recusa e diz a distância.
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path, lat, lng, accuracy_m) values (%L, %L, -23.5415, -46.6333, 20)', test.id('g'), path),
    '%1001 m da academia mais próxima (Smart Fit Centro)%300 m%');

  -- Perto, mas com GPS impreciso demais.
  perform test.expect_error(
    format('insert into public.checkins (group_id, photo_path, lat, lng, accuracy_m) values (%L, %L, -23.5505, -46.6333, 900)', test.id('g'), path),
    '%GPS fraco%');

  -- Cerca de 200 m: aceita. O app tenta mandar academia e distância falsas, o banco recalcula.
  insert into public.checkins (group_id, photo_path, lat, lng, accuracy_m, gym_id, gym_name, distance_m)
  values (test.id('g'), path, -23.5487, -46.6333, 15, gen_random_uuid(), 'Falsa', 0);
  select * into c from public.checkins where user_id = test.id('a') and day = public.local_today(test.id('g'));
  assert c.gym_id = test.id('gym'), 'academia decidida pelo banco';
  assert c.gym_name = 'Smart Fit Centro', 'nome da academia guardado';
  assert c.distance_m between 195 and 205, format('distância calculada pelo banco (%s)', c.distance_m);
end $$;

-- ---------------------------------------------------------------------
-- Visibilidade, limites e regra desligada
-- ---------------------------------------------------------------------
:as_b
do $$
declare path text := test.id('g') || '/' || test.id('b') || '/loc1.jpg';
begin
  assert (select count(*) from public.gyms) = 1, 'parceiro vê a academia do grupo';
  -- Exatamente na borda (~299 m) passa.
  insert into public.checkins (group_id, photo_path, lat, lng) values (test.id('g'), path, -23.5478, -46.6333);
  perform test.expect_error(format('update public.gyms set lat = 0 where id = %L', test.id('gym')), '%permission denied%');
end $$;

:as_c
do $$
begin
  assert (select count(*) from public.gyms) = 0, 'quem é de fora não vê academias';
  perform test.expect_error(
    format('insert into public.gyms (group_id, name, lat, lng) values (%L, ''Minha casa'', 0, 0)', test.id('g')),
    '%row-level security%');
  update public.groups set require_location = false;
end $$;
:as_admin
do $$ begin assert (select require_location from public.groups where id = test.id('g')), 'quem é de fora não desliga a regra'; end $$;

:as_a
do $$
begin
  for i in 2..10 loop
    insert into public.gyms (group_id, name, lat, lng) values (test.id('g'), 'Academia ' || i, 0, 0);
  end loop;
  perform test.expect_error(
    format('insert into public.gyms (group_id, name, lat, lng) values (%L, ''Onze'', 0, 0)', test.id('g')),
    '%10 academias%');
  delete from public.gyms where name like 'Academia %';
  perform test.expect_error(
    format('insert into public.gyms (group_id, name, lat, lng) values (%L, ''Fora do mapa'', 95, 0)', test.id('g')),
    '%check constraint%');

  -- Com a regra desligada, check-in sem localização volta a valer.
  update public.groups set require_location = false where id = test.id('g');
  assert not (select require_location from public.groups where id = test.id('g')), 'membro desliga a regra';
end $$;

:as_admin
delete from public.checkins where day = public.local_today(test.id('g'));
:as_a
do $$
begin
  insert into public.checkins (group_id, photo_path)
  values (test.id('g'), test.id('g') || '/' || test.id('a') || '/sem-gps.jpg');
  assert (select gym_id is null from public.checkins where user_id = test.id('a') and day = public.local_today(test.id('g'))),
    'sem posição, sem academia';
end $$;

-- Remover a academia não apaga o histórico do check-in.
:as_admin
update public.checkins set gym_id = test.id('gym'), gym_name = 'Smart Fit Centro'
where user_id = test.id('a') and day = public.local_today(test.id('g'));
:as_a
do $$
begin
  delete from public.gyms where id = test.id('gym');
  assert (select gym_id is null and gym_name = 'Smart Fit Centro' from public.checkins
          where user_id = test.id('a') and day = public.local_today(test.id('g'))), 'histórico mantém o nome';
end $$;

\echo '  verificação de localização passou'
