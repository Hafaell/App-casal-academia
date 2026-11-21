# Treino a Dois: progresso do projeto

Ponto de partida de toda sessão. Instruções para o Claude Code ficam no [CLAUDE.md](./CLAUDE.md); instalação e regras de negócio no [README.md](./README.md).

Última atualização: 21/11/2026 (leva 2 de funções do casal) · Branch de trabalho: `react-native` (só app nativo; o site PWA vive em `develop`/`main`) · Versão do app: 0.1.0

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**.

---

## 1. Produto

App para o casal (Rafael e a namorada) manter a academia.

- Meta de **4 treinos por semana** (segunda a sábado; sábado opcional; domingo é folga), cada um provado por **foto tirada na hora**, sem galeria, a até 100 m de uma academia cadastrada.
- Domingo às 23h59 a semana fecha. Quem não bateu a meta recebe **multa sorteada (R$10 a R$50) e punição da roleta**. Se os dois falham, pagam o mesmo.
- Exceções (doença, viagem, lesão) reduzem a meta em 1 por dia útil. **1 coringa por mês** cancela a punição de uma semana.
- Dinheiro por **Pix manual**; o app só registra quem deve e quanto entrou.
- Futuro: grupos de amigos com regras próprias e ranking.

---

## 2. Estado atual

- **Supabase de produção** (`treino-a-dois`, São Paulo) com as 9 migrações em `supabase/migrations/`, RLS em todas as tabelas, bucket `checkins` privado e job `fechar-semanas` ativo. Teste e2e passou nos 53 passos em 15/11/2026.
- **App nativo** (Expo SDK 58, pasta `mobile/`): 13 telas, câmera, GPS, mapa, carimbo na foto, cartão da semana, reações, reports. Typecheck, expo-doctor, export iOS/Android e testes de tela passam.
- **Testado no iPhone via Expo Go em 20/11/2026.** O Expo Go exige conta Expo (gratuita) logada no computador e no celular, e só abre o app com `npx expo start` rodando.
- O site na Vercel (`https://treino-a-dois-theta.vercel.app`) continua no ar; o app nativo ainda usa o `/api/maps-link` dele para links curtos do Maps.
- `mobile/.env.local` já está preenchido com a URL e a chave anon (fora do git).
- **Leva 1 de funções para o casal pronta em 20/11/2026** ([plano-leva-1.md](./plano-leva-1.md)): treino juntos (selo no feed e contagem no Início), caixinha com objetivo, a tela "Nossa história" (relatório do mês) e a tela "Stories e colagens" (stories de treinos juntos e do mês, e colagem do ano, com compartilhar de um toque). A chave Pix foi feita e retirada a pedido. Migração `20261120000001_kitty_goals.sql` aplicada em 21/11/2026.
- **Leva 2 pronta em 21/11/2026** ([plano-leva-2.md](./plano-leva-2.md)): roleta de prêmios (um giro a cada 2 semanas seguidas), planejar a semana com o "vamos?" (aviso dentro do app) e exceção com resposta do parceiro (pode recusar até 23h59 do dia em que foi marcada). Migração `20261121000001_rewards_plans_exception_review.sql` aplicada em 21/11/2026.

### Não verificado ainda

- Migrações `20261120000001_kitty_goals.sql` e `20261121000001_rewards_plans_exception_review.sql` **aplicadas em 21/11/2026** (pelo SQL Editor, com "Success"; as tabelas novas respondem na API). Ainda falta **usar** as telas novas no celular para conferir.
- Testes do banco (01 a 06) **rodaram e passaram em 21/11/2026** num Postgres portátil local, com um leitor em Node no lugar do `psql` (feito numa pasta temporária, fora do projeto). `npm run test:db` continua precisando de `psql`.
- Compartilhar imagem (stories, colagem, semana) ainda não conferido no iPhone depois da troca para um toque só.

- Câmera e GPS dentro da academia, num uso real do dia a dia (precisão do GPS em ambiente fechado).
- **Primeiro fechamento real** da semana pelo `pg_cron` (domingo às 23h59). Se falhar, o app chama `catch_up_weeks` ao abrir.
- Busca de academias pelo nome no Google Maps (precisa de chave `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, não ativada).

---

## 3. Próximos passos

### Prioridade 1: usar de verdade

- [ ] Os dois criam conta, formam o grupo (convite em Mais > Grupo e regras) e cadastram as academias.
- [ ] Fazer check-in real, ver no feed do outro celular, testar exceção e coringa.
- [ ] Conferir o primeiro fechamento de semana e a multa na Caixinha.
- [ ] Decidir como instalar sem depender do PC:
  - **Publicar na nuvem do Expo** (grátis): o Expo Go abre o app sem o computador ligado.
  - **Conta Apple Developer** (US$ 99/ano) para TestFlight e App Store. No Windows, o build sai pela nuvem do Expo (EAS). Plano e custos em [app-comerciavel.md](./app-comerciavel.md).
- [ ] Levar `react-native` para a `develop` quando estiver estável.

### Prioridade 2: melhorias

- [ ] **Notificações push** (lembrete de treino, aviso de fechamento com punição). Hoje ninguém é avisado sozinho.
- [x] Leva 1 das funções do casal: F4 treino juntos, F2 caixinha com objetivo, F1 relatório do mês, stories e colagem do ano ([plano-leva-1.md](./plano-leva-1.md)). O vídeo do ano ficou para depois.
- [x] Leva 2: F3 roleta de prêmios, F5 planejar a semana e "vamos?", F6 exceção com resposta do parceiro ([plano-leva-2.md](./plano-leva-2.md)).
- [ ] Próximas funções do casal: [melhorias-casal.md](./melhorias-casal.md) (sobram F7 a F11).

### Prioridade 3: qualidade

- [ ] CI no GitHub Actions (`typecheck`, `test`, `export`).
- [ ] Tipos do banco gerados (`supabase gen types`) no lugar dos tipos escritos à mão.
- [ ] Revisão de segurança e de acessibilidade.

### Prioridade 4: grupos de amigos

Hoje **qualquer membro edita regras e roleta** e o código de convite nunca expira. Para mais de 2 pessoas falta: ranking, papéis (só o `owner` edita; o campo `role` já existe), tela para remover membros e trocar o convite, revisão de placar, caixinha e feed pensados para 2, e decidir se a multa é por grupo ou por pessoa.

---

## 4. Decisões já tomadas e pendentes

| Tema | Hoje | Pendência |
| --- | --- | --- |
| Multa | Por semana, valor sorteado (mudar exige alterar `close_week`) | |
| Exceção | Reduz 1 por dia útil, sem limite mensal; o parceiro pode recusar até 23h59 do dia em que foi marcada | |
| Treino no domingo | Não conta (configurável por grupo) | |
| Localização | Até 100 m de uma academia da pessoa; desligável por grupo | Ajustar o raio se o GPS indoor atrapalhar (`gym_radius_m()` no banco e `GYM_RADIUS_M` no app) |
| Recompensa quando os dois batem a meta | Roleta de prêmios: um giro a cada 2 semanas seguidas | Mudar o intervalo exige `reward_every_weeks()` no banco e `REWARD_EVERY_WEEKS` em `src/domain/rewards.ts` |
| Destino do dinheiro da caixinha | Objetivo com barra de progresso (um aberto por vez) e "Usar o dinheiro" | |
| Treino juntos | Mesmo dia, até 200 m e até 3 h de diferença; só estatística | Ajustar 200 m / 3 h em `src/domain/together.ts` se errar |
| Nome do app | "Treino a Dois" (provisório) | Definir |
| Confirmação de e-mail | Desligada (uso do casal) | Religar se abrir para amigos |

---

## 5. Riscos e limitações

- **Foto "tirada na hora" não é garantida de forma absoluta [Certa].** O parceiro vendo o feed é o fiscal real.
- **GPS dá para falsificar [Certa]** (mais comum no Android) e dentro de prédio erra 50 m ou mais. O banco recusa leituras com margem acima de 500 m. Cadastrar a academia por "Estou na academia agora" é o jeito mais preciso.
- **Academias são por pessoa**: cada um cadastra as suas e só vale perto das suas. Dá para cadastrar a própria casa; o parceiro vê a lista e pode reportar o treino.
- **Supabase gratuito pausa após cerca de 7 dias sem uso [Provável].** Se pausar, o fechamento não roda; reativar pelo painel resolve.
- **Fechamento depende do `pg_cron`**, com rede de segurança no app (`catch_up_weeks`, idempotente).
- **Fuso:** o grupo usa o fuso de quem o criou (`America/Sao_Paulo`); viajar não muda a regra.
- **Qualquer membro marca a multa como paga**, sem confirmação de quem recebe.
- **Fotos** de 100 a 300 KB; o plano gratuito tem 1 GB **[Provável]**. Ideia: apagar fotos antigas.

---

## 6. Mapa do repositório

```
PROGRESSO.md, CLAUDE.md, README.md   documentação do projeto
app-comerciavel.md                   plano de lojas, custos e segurança comercial
melhorias-casal.md                   ideias de funções para o casal
plano-leva-1.md                      plano e resultado da leva 1 (F4, F2, F1)
plano-leva-2.md                      plano e resultado da leva 2 (F3, F5, F6)
mobile/                              app nativo (Expo); detalhes em mobile/README.md
src/domain/                          regras puras com teste (usadas pelo app via @domain/)
supabase/migrations/                 esquema, Storage, agendamento e ajustes (nunca editar as aplicadas)
supabase/tests/                      testes do banco (01 regras, 02 localização, 03 reações, 04 reports, 05 caixinha com objetivo, 06 prêmios, planos e exceção com resposta)
scripts/e2e-supabase.mjs             teste de ponta a ponta contra o Supabase real
```

Tabelas: `profiles`, `groups`, `group_members`, `gyms`, `punishments`, `checkins`, `exceptions`, `jokers`, `weeks`, `week_results`, `reactions`, `checkin_reports`, `kitty_withdrawals`, `kitty_goals`, `exception_rejections`, `rewards`, `reward_spins`, `workout_plans`, `nudges`. Funções principais: `create_group`, `join_group`, `leave_group`, `close_week`, `close_due_weeks`, `catch_up_weeks`, `set_debt_status`, `report_checkin`, `complete_kitty_goal`, `review_exception`, `spin_reward`.

---

## 7. Como retomar numa nova sessão

1. Ler este arquivo e o `README.md`.
2. `git checkout react-native && git pull`, depois `npm install` na raiz e em `mobile/`.
3. Rodar `npm test` e `npm run typecheck` (raiz e `mobile/`) para ver se o ambiente está saudável.
4. Escolher um item da seção 3.
5. Ao terminar, atualizar este arquivo: mover o que ficou pronto, ajustar o backlog e a data no topo.
