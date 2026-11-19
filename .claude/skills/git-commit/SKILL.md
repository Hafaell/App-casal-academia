---
name: git-commit
description: Regras para commit, push e merge neste repositório. Use sempre que o usuário pedir para commitar, dar push, fazer merge ou qualquer operação git que grave ou publique alterações.
---

# Git Commit

## Regra principal

Nunca faça commit, push ou merge por iniciativa própria. Só execute essas ações quando o usuário pedir de forma explícita naquela mensagem. Aprovação anterior não vale para pedidos novos.

## Commit e push

- Só quando o usuário pedir (ex: "faz o commit e o push").
- Sempre na branch `develop`. Se estiver em outra branch, avise e troque para `develop` antes (sem perder alterações), ou pergunte se houver conflito.
- Antes de commitar: rode `git status` e `git diff` para conferir o que vai entrar.
- Não inclua arquivos com segredos (`.env`, credenciais, chaves).
- Mensagem de commit curta, no imperativo, em português, descrevendo o que mudou.
- Push com `git push origin develop`. Nunca use `--force`.

## Merge com a main

- Só quando o usuário pedir explicitamente o merge da `develop` na `main`.
- Passos: atualizar `develop` e `main`, ir para `main`, `git merge develop`, `git push origin main`, e voltar para `develop`.
- Se houver conflito, pare e mostre o conflito ao usuário antes de resolver.
- Nunca faça commit direto na `main`.

## Sem pedido explícito

Se o usuário só pedir para editar código, edite os arquivos e pare. Não faça commit, push nem merge. Pode lembrar que as alterações estão pendentes.
