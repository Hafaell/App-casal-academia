---
name: conferir-migracoes
description: Descobre quais migrações de supabase/migrations já estão aplicadas no Supabase de produção, gerando um SQL de conferência para colar no SQL Editor. Use quando o usuário perguntar "a migração foi aplicada?", "o banco está atualizado?", "confere as migrações", ou antes de criar uma migração nova.
---

# Conferir migrações

As migrações foram aplicadas pelo SQL Editor, então não existe a tabela de controle da CLI. A única forma de saber é olhar se o que cada arquivo cria existe no banco.

## Frases que chamam esta skill

- "Confere se as migrações estão aplicadas"
- "A migração da caixinha foi aplicada?"
- "O banco está igual ao código?"

## Passos

1. Liste os arquivos em `supabase/migrations/`.
2. Para cada um, escolha um objeto que só ele cria ou muda (tabela, função, política, job do cron). Se surgiu migração nova, acrescente uma linha na consulta abaixo.
3. Entregue a consulta ao usuário, com o passo a passo do fim desta página.
4. Com o resultado, atualize a seção "Não verificado ainda" do PROGRESSO.md e diga o que falta aplicar (use a skill `nova-migracao` para orientar a aplicação).

## Consulta (só lê, não muda nada)

```sql
select * from (values
  ('20261113000001_schema',            to_regclass('public.week_results') is not null),
  ('20261113000002_storage',           exists (select 1 from pg_proc where proname = 'can_read_photo')),
  ('20261113000003_schedule',          exists (select 1 from cron.job where jobname = 'fechar-semanas')),
  ('20261116000001_gym_location',      to_regclass('public.gyms') is not null),
  ('20261119000001_gym_radius_100',    exists (select 1 from pg_proc where proname = 'gym_radius_m' and prosrc like '%100%')),
  ('20261119000002_reactions_and_kind',to_regclass('public.reactions') is not null),
  ('20261119000003_report_checkin',    to_regclass('public.checkin_reports') is not null),
  ('20261119000004_kitty_withdrawals', to_regclass('public.kitty_withdrawals') is not null),
  ('20261119000005_gyms_per_person',   exists (select 1 from pg_policies where tablename = 'gyms' and policyname = 'gyms_delete' and qual like '%created_by%'))
) as t(migracao, aplicada)
order by migracao;
```

## Passo a passo para o dono do projeto

1. Abra https://supabase.com/dashboard e entre no projeto **treino-a-dois**.
2. Menu da esquerda: **SQL Editor** > **New query**.
3. Cole a consulta e clique em **Run**.
4. Você deve ver uma tabela com duas colunas: `migracao` e `aplicada` (`true` ou `false`).
5. Mande para o Claude as linhas que vierem `false` (ou um print da tabela).
6. Se der erro `schema "cron" does not exist`, o agendamento não está instalado: apague a linha do `schedule`, rode de novo e avise o Claude.

Essa consulta não altera nada, pode rodar quantas vezes quiser.
