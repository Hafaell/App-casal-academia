# Plano da leva 2: roleta de prêmios, planejar a semana e exceção com resposta

Criado em 21/11/2026. Segunda leva das funções do [melhorias-casal.md](./melhorias-casal.md): F3, F5 e F6. A leva 1 está no [plano-leva-1.md](./plano-leva-1.md).

**Situação em 21/11/2026: código pronto, testado e as duas migrações (leva 1 e leva 2) já aplicadas no Supabase** pelo SQL Editor, ambas com "Success. No rows returned". Falta usar as telas novas no celular.

## Decisões do Rafael (21/11/2026)

| Função | Decisão |
| --- | --- |
| F6 exceção | O parceiro pode **recusar até as 23h59 do dia em que a exceção foi marcada**. Sem resposta até lá, ela vale. |
| F3 prêmios | Um giro **a cada 2 semanas seguidas** em que os dois batem a meta. |
| F5 planejar | O "vamos?" e os planos aparecem **dentro do app**. Notificação de verdade só com o app compilado (conta Apple). |

## F6. Exceção com resposta do parceiro

**Como funciona:** quem marca a exceção vê "⏳ Aguardando o parceiro até 23h59 de hoje". O parceiro vê o pedido no Início (e no Feed e na tela de exceções) com **✓ Aprovar** e **✕ Recusar**. Recusar pede um motivo opcional, apaga a exceção (o dia volta a contar na meta) e deixa um aviso no Feed. Passado o prazo, os botões somem e a exceção vale.

**Regra de dinheiro:** recusar apaga a exceção, do mesmo jeito que "reportar treino" apaga o check-in. Por isso `close_week` e `src/domain/rules.ts` **não mudaram**: os dois contam as exceções que existem. Semana fechada não aceita recusa.

- [x] Banco: colunas `reviewed_by` e `reviewed_at` em `exceptions`, tabela `exception_rejections` e função `review_exception` (confere prazo, quem responde e semana fechada).
- [x] `src/domain/exceptionReview.ts`: estado da resposta (aberta, aprovada, minha, prazo acabou), com testes.
- [x] App: `mobile/src/components/ExceptionReview.tsx` no Início, no Feed e em Exceções; aviso de recusa no Feed.

## F3. Roleta de prêmios

**Como funciona:** a cada 2 semanas seguidas de meta batida pelos dois (o coringa não quebra nem soma), aparece no Início "🎁 Vocês ganharam um giro". Na tela **Roleta de prêmios** (em Mais) o casal gira, vê o prêmio e depois marca "Aproveitado". A lista de prêmios é editável (6 sugestões iniciais: massagem, jantar, folga de tarefa, café na cama, escolher o filme, sobremesa).

- [x] Banco: tabelas `rewards` e `reward_spins`, prêmios iniciais para grupos novos e antigos, e função `spin_reward`, que confere a sequência e sorteia. Cada marco só pode ser girado uma vez.
- [x] `src/domain/rewards.ts`: os mesmos marcos do banco (`REWARD_EVERY_WEEKS = 2`, igual a `reward_every_weeks()`), com testes.
- [x] App: tela `/premios` e aviso no Início.

## F5. Planejar a semana e "vamos?"

**Como funciona:** na tela **Planejar a semana** (em Mais e no Início), cada um marca "Vou treinar" nos próximos 14 dias e, se quiser, Manhã, Tarde ou Noite, e vê o plano do outro. O Início mostra o **plano de hoje** dos dois e o botão **💪 Vamos?**. Quem recebe vê "💪 Ana chamou: bora treinar?" com **Bora!** (abre o check-in) e **Agora não**. Dá para chamar de novo depois de meia hora.

**Fica para depois:** lembrete antes do horário e notificação do "vamos?" no celular (precisam do app compilado; ver `pre-lancamento`).

- [x] Banco: tabelas `workout_plans` e `nudges`, com gatilhos (dia entre hoje e 13 dias à frente; não chamar a si mesmo nem quem é de fora; meia hora entre chamadas).
- [x] App: tela `/planejar`, cartão "Plano de hoje" e aviso do "vamos?" no Início.

## Revisão das regras de dinheiro (agente `revisor-regras-dinheiro`)

O revisor confirmou que banco e app calculam igual (exceções e marcos da roleta, inclusive coringa, grupo de 3 e semana sem resultados). Corrigido na própria migração, que ainda não foi aplicada:

- [x] **Recusa que não segurava:** depois de recusada, a pessoa podia marcar a mesma exceção de novo e ganhar um prazo novo. Agora o banco recusa ("O seu parceiro recusou a exceção desse dia"). Coberto no teste do banco e no de tela.
- [x] Recusar com a semana já fechada dá mensagem clara ("A exceção já valeu").
- [x] Duas pessoas respondendo ou girando ao mesmo tempo: a exceção fica travada durante a resposta, e o segundo giro recebe "já foi girada".

Ficou como está (decisão de produto): quem já tiver várias semanas seguidas antes da atualização ganha os giros acumulados de uma vez.

## Fechamento

- [x] Teste do banco `supabase/tests/06_couple_features.sql`, incluído no `run.sh`. **Rodou e passou em 21/11/2026 num Postgres portátil local (as 10 migrações aplicadas num banco vazio e os testes 01 a 06 passaram), com um leitor em Node no lugar do `psql`.**
- [x] Raiz: `npm test` (70 testes) e `npm run typecheck` passam.
- [x] `mobile/`: `npm test` (30 testes: 27 de tela, sendo 7 novos, e 3 de imagem), `npm run typecheck`, `npm run doctor` (20/20) e `npm run export` passam.
- [x] Se as tabelas novas não existirem no banco, o Início abre normal e as telas novas avisam (há teste para isso).
- [x] **Migrações aplicadas no SQL Editor do Supabase** em 21/11/2026 (a da leva 1 e a da leva 2, nesta ordem). O SQL foi colado sem a maior parte dos comentários; o conteúdo executável é o dos arquivos.
- [ ] Commit na branch `react-native`, quando o Rafael pedir.

## Como as migrações foram aplicadas (referência, para as próximas)

São duas, **nesta ordem**: primeiro a da leva 1, depois a da leva 2.

1. Abra `https://supabase.com/dashboard` no navegador e entre na sua conta.
2. Clique no projeto **treino-a-dois** (não no "Financeiro").
3. No menu da esquerda, clique em **SQL Editor** e depois em **New query**.
4. No VS Code, abra `supabase/migrations/20261120000001_kitty_goals.sql`, aperte `Ctrl+A` e `Ctrl+C`.
5. No SQL Editor, clique na caixa de texto, aperte `Ctrl+V` e depois **Run**. Deve aparecer "Success. No rows returned".
6. Clique em **New query** de novo e repita os passos 4 e 5 com `supabase/migrations/20261121000001_rewards_plans_exception_review.sql`.
7. Abra o app: em **Mais** devem funcionar "Roleta de prêmios" e "Planejar a semana", e a Caixinha deve mostrar o objetivo.

**Se der errado:** não rode de novo às cegas. Copie a mensagem em vermelho e mande para o Claude. "already exists" na migração da leva 1 quer dizer que ela já tinha sido aplicada: pode seguir para a da leva 2.

As duas migrações só **adicionam** coisas (tabelas, colunas, funções). Não apagam dados e não custam nada.
