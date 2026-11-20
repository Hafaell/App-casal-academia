---
name: rodar-e2e-e-limpar
description: Roda o teste de ponta a ponta (npm run test:e2e) contra o Supabase REAL e entrega o SQL para limpar as contas e grupos de teste que ficam no banco. Use quando o usuário disser "roda o teste de ponta a ponta", "testa contra o banco de verdade", "roda o e2e", "limpa as contas de teste".
---

# Teste de ponta a ponta e limpeza

O teste usa o banco de produção, onde estão os dados reais do casal. Por isso:

**Peça confirmação antes de rodar**, explicando que ele cria 3 contas `e2e-*@treinoadois-e2e.com` e um grupo `E2E ...` no Supabase real, e apaga só o que ele mesmo criou.

## Frases que chamam esta skill

- "Roda o teste de ponta a ponta"
- "Testa o app contra o Supabase de verdade"
- "Limpa as contas de teste do banco"

## Passos

1. Confira se existe `.env.local` na raiz com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Se não existir, explique onde pegar (Supabase > Project Settings > API) e pare. Nunca use nem peça a chave `service_role`.
2. Rode `npm run test:e2e` na raiz. Se for domingo, o script também testa o bloqueio de check-in de domingo.
3. Resuma: quantos passos passaram e quais falharam (linhas `FALHA`), com a causa provável.
4. Se alguma falha indicar que falta migração (tabela ou função inexistente), sugira a skill `conferir-migracoes`.
5. Entregue o SQL de limpeza com o passo a passo abaixo.

## Limpeza (o dono do projeto roda)

```sql
delete from public.groups where name like 'E2E %';
delete from auth.users where email like 'e2e-%@treinoadois-e2e.com';
```

1. Abra https://supabase.com/dashboard, projeto **treino-a-dois** (nunca o "Financeiro").
2. **SQL Editor** > **New query**, cole as duas linhas e clique em **Run**.
3. O Supabase pode avisar que a consulta é destrutiva ("destructive operation"): confirme. Só apaga o que começa com `E2E ` e `e2e-`.
4. Você deve ver "Success". Se der erro de chave estrangeira, mande a mensagem para o Claude.

Explique que esse `delete` não tem volta, mas só atinge dados de teste.
