---
name: nova-migracao
description: Cria uma migração nova do banco (Supabase) do jeito certo e guia o dono do projeto para aplicá-la no SQL Editor. Use sempre que for preciso mudar tabela, coluna, política RLS, função, gatilho ou agendamento do banco, ou quando o usuário disser coisas como "muda a regra no banco", "cria uma migração", "preciso de uma coluna nova", "altera a multa", "muda o raio da academia".
---

# Nova migração

O banco é a fonte da verdade do que vale dinheiro. Erro aqui vira multa errada.

## Frases que chamam esta skill

- "Cria uma migração para ..."
- "Preciso mudar a regra da multa no banco"
- "Adiciona uma coluna X na tabela Y"
- "Muda o raio da academia para 150 m"

## Passos

1. **Nunca edite um arquivo que já existe em `supabase/migrations/`.** Todas as migrações atuais estão em produção (confira a pendência da `20261119000004_kitty_withdrawals.sql` no PROGRESSO.md; se houver dúvida, rode a skill `conferir-migracoes` antes).
2. Crie `supabase/migrations/AAAAMMDDHHMMSS_descricao.sql`, com timestamp maior que o do último arquivo e descrição curta em inglês com `_`.
3. Cabeçalho em português explicando o que muda para o usuário (siga o estilo dos arquivos existentes).
4. Escreva SQL **idempotente** sempre que der: `create or replace function`, `drop policy if exists` antes de `create policy`, `add column if not exists`, `create index if not exists`.
5. Toda tabela nova: `alter table ... enable row level security` e políticas usando `public.is_member(group_id)`. Funções com `security definer` sempre com `set search_path = public`.
6. Se mudou regra de meta, check-in, exceção, coringa ou fechamento (`close_week`, gatilhos):
   - mude também `src/domain/rules.ts` (ou o arquivo de `src/domain/` equivalente) para o placar ao vivo ficar idêntico;
   - atualize `supabase/tests/01_rules.sql` (ou o teste do banco correspondente);
   - rode `npm test` na raiz;
   - chame o agente `revisor-regras-dinheiro` para comparar os dois lados.
7. Se mudou o raio, mude `gym_radius_m()` no banco e `GYM_RADIUS_M` em `src/domain/geo.ts`.
8. Se a tabela ou coluna aparece no app, ajuste `mobile/src/data/types.ts` e `mobile/src/data/queries.ts`.
9. Atualize o PROGRESSO.md: a migração nova entra como "ainda não aplicada".

## Como o dono do projeto aplica (explique exatamente assim)

Ele não usa a CLI do Supabase. Não sugira `supabase db push` (tentaria reaplicar tudo).

1. Abra o navegador em https://supabase.com/dashboard e entre na conta.
2. Clique no projeto **treino-a-dois** (não no "Financeiro").
3. No menu da esquerda, clique em **SQL Editor** e depois em **New query**.
4. Abra o arquivo da migração, copie todo o conteúdo e cole na caixa.
5. Clique em **Run** (canto inferior direito). Você deve ver "Success. No rows returned".
6. Se aparecer erro em vermelho: não rode de novo às cegas. Copie a mensagem e mande para o Claude.
7. Depois, rode a skill `conferir-migracoes` para confirmar e avise o Claude para marcar no PROGRESSO.md.

Avise antes se a migração apaga dados (`drop table`, `delete`, `drop column`): isso não tem volta.
