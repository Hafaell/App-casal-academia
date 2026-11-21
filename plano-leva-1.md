# Plano da leva 1: treino juntos, caixinha com objetivo e nossa história

Criado em 20/11/2026. Primeira leva das funções do [melhorias-casal.md](./melhorias-casal.md): F4, F2 e F1. Cada passo tem uma caixa, marcada quando o passo ficou pronto e testado.

**Situação em 20/11/2026: código pronto e testado. A migração foi aplicada no Supabase em 21/11/2026** (junto com a da leva 2).

**Ajuste de 20/11/2026, a pedido do Rafael:** a chave Pix e o "Copiar Pix" foram retirados (a Caixinha volta a ter só o botão de retirar, mais o objetivo). As imagens para compartilhar saíram da "Nossa história" e foram para uma tela própria, "Stories e colagens", com botões de um toque só (detalhes no fim da seção F1).

Nenhuma das três funções mexe na regra de dinheiro (`close_week`, meta, multa). Por isso `src/domain/rules.ts` e `supabase/tests/01_rules.sql` não mudaram.

---

## Passo 0: conferir o banco

- [x] A migração `20261119000004_kitty_withdrawals.sql` (retiradas da caixinha) **está aplicada** em produção. Conferido em 20/11/2026 pela API: a tabela `kitty_withdrawals` responde.

## F4. Treino juntos

**Regra:** os dois fizeram check-in no **mesmo dia**, a **até 200 m** um do outro e com **até 3 horas** de diferença. Check-in sem GPS não conta. É só estatística: não vale treino a mais nem muda a multa.

- [x] `src/domain/together.ts`: função que acha os dias de treino juntos (4 testes).
- [x] Feed: selo "💑 Treinaram juntos" nos dois treinos do dia.
- [x] Início: cartão "Nossa história · Juntos N vezes em novembro", que leva para a tela nova.

## F2. Caixinha com objetivo

**Como funciona:** o casal define um objetivo (ex.: "Viagem para a praia", R$ 300). A barra mostra o saldo da caixinha contra o valor do objetivo. Ao chegar no valor, o botão "Usar o dinheiro" registra a retirada e conclui o objetivo, as duas coisas de uma vez no banco. Há um objetivo aberto por vez; os concluídos ficam listados.

~~Pix copia e cola~~: feito e depois **retirado** a pedido do Rafael. A Caixinha continua só registrando; o Pix é feito por fora, como antes.

- [x] Migração nova `supabase/migrations/20261120000001_kitty_goals.sql`: tabela `kitty_goals` (com RLS e permissões por coluna) e função `complete_kitty_goal`. (As colunas da chave Pix foram tiradas do arquivo antes de ele ser aplicado.)
- [x] Teste do banco `supabase/tests/05_kitty_goals.sql`, incluído no `run.sh`. **Rodou e passou em 21/11/2026 num Postgres portátil local (as 10 migrações aplicadas num banco vazio e os testes 01 a 06 passaram), com um leitor em Node no lugar do `psql`.**
- [x] `queries.ts` e `types.ts`: ler, criar, editar, concluir e apagar objetivo.
- [x] Caixinha: cartão do objetivo com barra de progresso, formulário e "Usar o dinheiro" (`mobile/src/components/KittyGoal.tsx`).
- [x] A retirada feita por um objetivo não mostra "Desfazer" (desfazer deixaria o objetivo marcado como feito com o dinheiro de volta).
- [x] Se a tabela nova ainda não existir no banco, a Caixinha abre normal e só esconde o objetivo (há teste para isso).

## F1. Nossa história (relatório do mês) e Stories e colagens

**Relatório do mês:** treinos juntos, treinos no mês, semanas que os dois bateram, multas do mês, sequência atual, dia da semana e período (manhã, tarde, noite) em que mais treinam, e os números de cada um. Setas para ver os meses anteriores. Só números: nada de compartilhar nesta tela.

**Stories e colagens** (tela própria, `/compartilhar`, em Mais e no fim da Nossa história), todas no formato de story (1080x1920), com setas para escolher o mês:

- **Story "treinamos juntos":** número grande de treinos juntos no mês, fotos desses treinos, sequência do casal e total de treinos juntos no ano.
- **Story do mês:** número de treinos do mês, semanas batidas, fotos do mês e treinos de cada um.
- **Colagem do ano:** até 12 fotos do ano, espalhadas pelos meses e com preferência para os treinos a dois, mais o total de treinos, de treinos juntos e de semanas batidas.

**Botão de um toque só:** antes, o primeiro toque só preparava a imagem (o texto mudava para "(pronto)") e era preciso tocar de novo para compartilhar; por isso parecia que nada acontecia. Agora um toque monta a imagem e já abre o compartilhar do celular. Se der erro, a mensagem aparece na tela e no terminal do Expo. O cartão da semana no Feed usa o mesmo botão.

**Fica para depois:** o vídeo do ano (exige gravar vídeo no aparelho; é o item mais pesado).

- [x] `src/domain/report.ts`: números do mês, resumo do ano e escolha das fotos (7 testes). `localHour` novo em `dates.ts`, usando o fuso do grupo.
- [x] `summaryCard.ts`: grade de 4 colunas com 12 fotos quadradas para a colagem. Testada com o Skia de computador: a grade de 12 fotos cabe na imagem de 1080x1350 (conferido na imagem gerada). O texto não aparece nesse teste, porque o Skia de computador não tem fontes; que ele cabe embaixo da grade vem da conta das medidas (a grade termina em 934 px, as três linhas de texto em cerca de 1190 px e o rodapé começa em 1252 px).
- [x] Tela "Nossa história" (`/historia`), com link em Mais e no Início: só o relatório.
- [x] Tela "Stories e colagens" (`/compartilhar`) e botão de um toque (`mobile/src/components/ShareImageButton.tsx`).
- [x] `summaryCard.ts`: formato story (1080x1920) e número em destaque. Testado com o Skia de computador (a grade fica abaixo do destaque e acima do texto).

## Fechamento

- [x] Testes de tela das três funções em `mobile/src/test/app.test.tsx` (5 testes novos).
- [x] Raiz: `npm test` (72 testes) e `npm run typecheck` passam.
- [x] `mobile/`: `npm test` (21 testes: 18 de tela, sendo 5 novos, e 3 de imagem), `npm run typecheck`, `npm run doctor` (20/20) e `npm run export` (iOS e Android) passam.
- [x] **Migração aplicada no SQL Editor do Supabase** em 21/11/2026 (o navegador automático não estava conectado). Passo a passo abaixo.
- [x] `PROGRESSO.md`, `melhorias-casal.md` e este plano atualizados.
- [ ] Commit na branch `react-native`: pela regra do projeto, só quando o Rafael pedir. As alterações estão salvas nos arquivos, ainda sem commit.

### Ajustes de ambiente feitos no caminho

- Os testes de tela não achavam `@babel/runtime` ao carregar `src/domain/`. Correção: `modulePaths` no Jest (`mobile/package.json`).
- `npm run doctor` chamava um programa não instalado. Agora usa `npx --yes expo-doctor`.
- No Windows, rode os testes do app com o caminho começando em **C:** maiúsculo (o PowerShell e o terminal do VS Code já fazem isso). Com "c:" minúsculo, o Jest carrega dois módulos do Expo diferentes e quase todos os testes de tela falham com "Cannot find native module 'ExpoLinking'".

---

## Como aplicar a migração (passo a passo)

1. Abra o navegador em `https://supabase.com/dashboard` e entre na sua conta. Você deve ver a organização "Hafael".
2. Clique no projeto **treino-a-dois** (cuidado para não abrir o "Financeiro").
3. No menu da esquerda, clique em **SQL Editor** (ícone de terminal). Abre uma área para digitar comandos do banco.
4. Clique em **New query** (ou no "+").
5. No VS Code, abra o arquivo `supabase/migrations/20261120000001_kitty_goals.sql`, aperte `Ctrl+A` e `Ctrl+C`.
6. Volte ao SQL Editor, clique na área de texto e aperte `Ctrl+V`.
7. Clique em **Run** (ou `Ctrl+Enter`). Você deve ver "Success. No rows returned".
8. Abra o app, vá em **Caixinha**: deve aparecer o cartão "Para onde vai o dinheiro?".

**Se der errado:**

- "relation kitty_goals already exists": a migração já foi aplicada. Nada a fazer.
- "relation kitty_withdrawals does not exist": a migração das retiradas não está no banco. Aplique antes `20261119000004_kitty_withdrawals.sql` do mesmo jeito e depois repita este passo.
- Qualquer outro erro: copie a mensagem e mande para o Claude.

Esta migração só **adiciona** coisas (uma tabela, uma função e três colunas). Não apaga nem muda dados que já existem e não custa nada.
