---
name: verificar-app
description: Roda as verificações certas conforme o que mudou (testes, typecheck, expo-doctor e export do app nativo, testes das regras na raiz) e resume o resultado em português simples. Use antes de dizer que uma tarefa terminou, antes de commit, ou quando o usuário disser "testa tudo", "está tudo funcionando?", "verifica o app", "roda os testes".
---

# Verificar o app

## Frases que chamam esta skill

- "Testa tudo"
- "Verifica se o app ainda compila"
- "Roda os testes antes de commitar"
- "Está tudo funcionando?"

## Passos

1. Veja o que mudou: `git status --porcelain` e `git diff --stat` (inclua arquivos não versionados).
2. Decida o que rodar:

| Mudou em | Rodar |
| --- | --- |
| `mobile/` | dentro de `mobile/`: `npm test`, `npm run typecheck`, `npm run doctor`, `npm run export` |
| `src/domain/` | na raiz: `npm test` e `npm run typecheck`; **e também** tudo de `mobile/` (o app importa `@domain/`) |
| `supabase/` | avise que `npm run test:db` precisa de `psql` e Postgres vazio, que não existem na máquina Windows do dono; rode só se o ambiente tiver |
| só `.md` | nada |

3. Se `node_modules` não existir em uma das pastas, rode `npm install` nela antes.
4. Rode os comandos independentes em paralelo quando possível. O `export` é o mais lento: rode por último ou em segundo plano.
5. **Não rode `npm run test:e2e`** aqui. Ele mexe no Supabase real; para isso existe a skill `rodar-e2e-e-limpar`.

## Como relatar

- Uma linha por comando: passou ou falhou.
- Se falhou: o trecho do erro que importa, a causa provável e a correção. Não esconda falha nem diga "passou" sem ter rodado.
- Se algo não pôde rodar (falta de `psql`, sem rede), diga qual e por quê.
