-- =====================================================================
-- Agendamento: fecha as semanas vencidas todo minuto 59 de cada hora.
-- No fuso de Brasília (UTC-3, sem horário de verão) isso cai exatamente
-- no domingo às 23h59. A função é idempotente, então rodar a cada hora
-- também recupera semanas que ficaram para trás.
-- =====================================================================

create extension if not exists pg_cron;

select cron.schedule(
  'fechar-semanas',
  '59 * * * *',
  $$ select public.close_due_weeks(); $$
);
