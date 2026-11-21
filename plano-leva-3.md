# Plano da leva 3: limite de exceções, desafio do mês e fotos de evolução

Criado em 21/11/2026. Pedido do Rafael: itens 7, 9 e 11 da lista de pendências. Os itens 8 (treino automático pelo relógio) e 10 (desafio entre os dois) **saíram da lista** por decisão dele.

**Situação em 21/11/2026: código pronto, testado e a migração `20261121000002_exception_limit_challenges_evolution.sql` aplicada no Supabase** pelo SQL Editor ("Success"). Uma consulta de conferência confirmou a coluna do limite, as tabelas `monthly_challenges` e `evolution_photos`, o bucket `evolution`, as 3 regras do Storage e as 4 funções. Falta usar as telas novas no celular.

## Decisões tomadas por mim (o Rafael pode mudar)

| Função | Decisão |
| --- | --- |
| 7. Limite de exceções | **4 por pessoa por mês**, contadas pelo mês do dia justificado. Muda em Mais > Grupo e regras (de 1 a 20). Exceção recusada não conta. |
| 9. Desafio do mês | Um desafio por mês para o casal, somando os dois. **Não mexe em meta nem multa.** Cumprido, vale um **giro extra na roleta de prêmios**. |
| 11. Fotos de evolução | **Privadas**: só quem tirou vê. A pessoa escolhe, foto por foto, mostrar ao parceiro. Nunca vão para o feed. |

## 7. Limite mensal de exceções

**Como funciona:** ao escolher o dia, a tela de exceções mostra "Restam 3 de 4 exceções em novembro". No limite, o botão trava e aparece "Você já usou as 4 exceções de novembro". O banco também recusa, para ninguém contornar.

**Regra de dinheiro:** o limite só age **ao marcar** a exceção. `close_week` e `src/domain/rules.ts` não mudaram: os dois continuam contando as exceções que existem.

- [x] Banco: coluna `exceptions_per_month` em `groups` e o gatilho `exceptions_before_insert` com o limite (mantendo todas as regras anteriores).
- [x] `src/domain/exceptionLimit.ts`, com testes.
- [x] App: aviso e trava em Exceções; campo "Exceções por pessoa no mês" em Grupo e regras.

## 9. Desafio do mês

**Como funciona:** em Mais > **Desafio do mês**, o casal escolhe uma sugestão com um toque ("Mês do cardio: 8", "Mês da dupla: 6 treinos juntos", "Mês cheio: 30", "Mês das aulas: 4") ou monta o seu: nome, o que conta (treinos somados, musculação, cardio, aulas ou treinos juntos) e a quantidade. Dá para criar para este mês e para o próximo. O Início mostra a barra de progresso. Cumprido, aparece "Girar a roleta de prêmios" e o giro extra entra na roleta.

- [x] Banco: tabela `monthly_challenges`, funções `challenge_progress` (mesma conta do app, inclusive "treinos juntos") e `spin_challenge_reward` (confere se foi cumprido e sorteia uma vez só).
- [x] `src/domain/challenges.ts`, com testes.
- [x] App: tela `/desafio`, cartão no Início e giro do desafio na roleta de prêmios.

## 11. Fotos de evolução

**Como funciona:** em Mais > **Fotos de evolução**. Na primeira vez, um aviso explica que as fotos são privadas. Dá para tirar na hora ou escolher da galeria, com data, peso e observação opcionais, e escolher se o parceiro vê. A tela mostra o **antes e depois** (primeira e última foto, com a diferença de peso), a sua galeria e as fotos que o parceiro escolheu mostrar. Cada foto pode passar a ser mostrada, deixar de ser mostrada ou ser apagada (some também do armazenamento).

**Privacidade (LGPD):** foto do corpo e peso são dados sensíveis. Ficam num armazenamento separado e privado (`evolution`), e as regras do banco só deixam ver quem tirou ou, se ela escolheu, o grupo.

- [x] Banco: tabela `evolution_photos`, bucket privado `evolution` e as regras de acesso.
- [x] App: tela `/evolucao`. Pacote novo: `expo-image-picker` (oficial do Expo, funciona no Expo Go), com os textos de permissão em português no `app.json`.

## Revisão das regras de dinheiro (agente `revisor-regras-dinheiro`)

Nada que impeça aplicar. O gatilho novo manteve todas as regras anteriores de exceção, e banco e app contam o mês igual (pelo dia justificado). O progresso do desafio, inclusive "treinos juntos", dá o mesmo número nos dois. As fotos de evolução só aparecem para quem tirou ou, se ela escolheu, para o grupo. Corrigido na própria migração:

- [x] Apagar e recriar o desafio dava outro giro: agora o desafio fica travado depois do giro (o banco recusa mudar ou apagar; a tela esconde os botões). Apagar o grupo inteiro continua funcionando.
- [x] Duas exceções da mesma pessoa no mesmo instante podiam passar do limite: agora uma espera a outra.
- [x] Quem é de fora do grupo não consegue ver o progresso de um desafio.

## Fechamento

- [x] Teste do banco `supabase/tests/07_limits_challenges_evolution.sql`, incluído no `run.sh`. **Rodou e passou** no Postgres portátil local, junto com os testes 01 a 06 e as 11 migrações num banco vazio.
- [x] Raiz: `npm test` (74 testes) e `npm run typecheck` passam.
- [x] `mobile/`: `npm test` (35 testes), `npm run typecheck`, `npm run doctor` (20/20) e `npm run export` passam.
- [x] Migração aplicada no SQL Editor do Supabase em 21/11/2026 e conferida.
- [ ] Commit na branch `react-native`, quando o Rafael pedir.
