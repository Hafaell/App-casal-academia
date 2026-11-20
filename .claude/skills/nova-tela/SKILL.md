---
name: nova-tela
description: Cria uma tela nova no app nativo (Expo Router) seguindo os padrões do projeto, com consulta ao Supabase só via queries.ts e teste com Supabase simulado. Use quando o usuário pedir "cria uma tela de ...", "quero uma página nova para ...", "adiciona uma aba ...".
---

# Nova tela no app

## Frases que chamam esta skill

- "Cria uma tela de ranking"
- "Quero uma página nova para ver as multas antigas"
- "Adiciona uma aba de estatísticas"

## Antes de escrever

1. Leia `mobile/AGENTS.md`: o Expo muda a cada versão. Confira a versão em `mobile/package.json` e consulte a documentação dessa versão antes de usar qualquer API do Expo.
2. Olhe uma tela parecida em `mobile/src/screens/` e a rota correspondente em `mobile/src/app/(app)/` para copiar o padrão.

## Regras

- **Rota** em `mobile/src/app/(app)/` (ou `(tabs)/` se for aba), com nome em português, arquivo fino que só renderiza a tela.
- **Tela** em `mobile/src/screens/NomeScreen.tsx`, usando os componentes de `mobile/src/components/ui.tsx` e as cores de `mobile/src/lib/theme.ts`.
- **Dados**: só por hooks em `mobile/src/data/queries.ts` (React Query). A tela nunca importa `supabase` direto. Tipos em `mobile/src/data/types.ts`.
- **Regras**: meta, sequência, datas e dinheiro vêm de `@domain/` (`rules.ts`, `streak.ts`, `dates.ts`). A tela não calcula nada disso.
- **"Hoje"**: sempre `localToday(group.timezone)` de `@domain/dates`, nunca `new Date()` do aparelho.
- Textos e mensagens de erro em português do Brasil; nomes de código em inglês.
- Dependência nova: `npx expo install <pacote>`, nunca `npm install`. Se tiver código nativo, avise que **não abre no Expo Go** e exigiria um build próprio.

## Teste

- Acrescente casos em `mobile/src/test/app.test.tsx` usando `fakeSupabase.ts` e `fixture.ts`.
- No fim, rode a skill `verificar-app`.

## Ao terminar

Explique ao dono como ver a tela no iPhone: `npx expo start` dentro de `mobile/`, abrir o Expo Go e ler o QR code. Diga onde a tela aparece no app (qual aba ou botão). Atualize o PROGRESSO.md.
