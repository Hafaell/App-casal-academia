-- =====================================================================
-- Treino a Dois: raio da academia passa de 300 m para 100 m.
-- O app usa o mesmo valor em GYM_RADIUS_M (src/domain/geo.ts).
-- =====================================================================

create or replace function public.gym_radius_m()
returns int
language sql
immutable
as $$ select 100; $$;
