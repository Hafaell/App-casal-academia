#!/usr/bin/env bash
# Roda os testes do banco num Postgres VAZIO (não use o banco do Supabase).
# Uso: DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${DATABASE_URL:?Defina DATABASE_URL apontando para um Postgres vazio}"

DB="treino_test_$$"
psql "$DATABASE_URL" -qX -c "create database $DB" >/dev/null
trap 'psql "$DATABASE_URL" -qX -c "drop database if exists $DB" >/dev/null' EXIT

base="${DATABASE_URL%%\?*}"
query="${DATABASE_URL#"$base"}"
URL="${base%/*}/$DB$query"
run() { psql "$URL" -qX -v ON_ERROR_STOP=1 -f "$1"; }

run supabase/tests/00_supabase_stubs.sql
for f in supabase/migrations/*.sql; do
  # pg_cron não existe num Postgres comum; o agendamento é testado só no Supabase.
  [[ "$f" == *schedule* ]] && continue
  run "$f"
done
# Os arquivos rodam na mesma sessão: o 02, 03 e 04 usam as pessoas e atalhos criados no 01.
psql "$URL" -qX -v ON_ERROR_STOP=1 -f supabase/tests/01_rules.sql -f supabase/tests/02_location.sql -f supabase/tests/03_reactions.sql -f supabase/tests/04_reports.sql -f supabase/tests/05_kitty_goals.sql -f supabase/tests/06_couple_features.sql
echo "Testes do banco: OK"
