# Treino a Dois: melhorias planejadas

Este arquivo guarda o contexto das melhorias sugeridas, para retomar depois sem precisar reconstruir a conversa. Ele complementa o backlog do `PROGRESSO.md`.

Estado de referência: branch `claude/gracious-pascal-sle0t1`, com a verificação de academia por GPS já implementada (último commit: `a146d11`).

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**.

---

## Status em 19/11/2026

| # | Melhoria | Status |
| --- | --- | --- |
| 1 | Aviso de check-in repetido | **Feito.** A tela Início já escondia o botão; agora a tela de check-in também avisa e volta |
| 2 | GPS só com a regra ligada | **Feito** |
| 3 | Erro ao carregar academias | **Feito.** Bloqueia, mostra a mensagem e o botão "Tentar de novo" |
| 4 | Separar `CheckinPage` em hooks | **Feito em parte.** A decisão do estado (perto, longe, sem academia, erro...) virou função pura em `src/domain/checkinGate.ts`, com testes. A câmera continua na tela: extrair `useCamera` fica para quando mexerem nela de novo |
| 5 | Testes de interface | **Parcial.** Os 5 casos (perto, longe, sem academia, já treinou, GPS negado) estão testados na lógica (`checkinGate.test.ts`). Playwright ainda não, pois precisa de um Supabase de teste |
| 6 | Foto sem internet | **Adiado de propósito.** O servidor decide o dia pela hora do envio; reenviar no dia seguinte contaria no dia errado e mexe em multa. A foto já fica na tela se o envio falhar |
| 7 | Mapa na tela Academias | **Feito** com Leaflet e OpenStreetMap (círculo de 100 m, sua posição, atribuição) |
| 8 | Botão de foto colorido | **Feito** (verde perto, cinza bloqueado) |
| 9 | Cor por pessoa | **Feito** no Histórico (barra colorida no dia e borda na foto) e no Feed. Quem saiu do grupo aparece em cinza |
| 10 | Revisar a tela Início | **Não feito.** Precisa ver a tela num iPhone |
| 11 | Pedido de revisão | **Trocado pelo pedido do casal:** outro membro pode **reportar** a foto e o treino é cancelado (ver abaixo) |
| 12 | Cartão do resumo semanal | **Feito.** No Feed, em cada semana fechada: toque 1 monta a imagem, toque 2 compartilha (o iPhone recusa compartilhar se demorar depois do toque). Se o aparelho não deixar, mostra a imagem para segurar e salvar |
| 13 | Reações nas fotos | **Feito** (💪 🔥 👏 😍, uma por pessoa) |
| 14 | Tipo de treino | **Feito**, opcional, escolhido na prévia da foto |
| 15 | Lembrete por horário | **Adiado.** Depende de notificações push (chaves, inscrição e Edge Function) |

### Reportar um check-in (pedido do casal)

A regra do GPS é a definitiva. Se alguém burlar, outro membro vê a foto no Feed e toca em **🚩 Reportar**, escrevendo o motivo.

- O treino é **cancelado**: o check-in é apagado, então a meta, a sequência e a multa se recalculam sozinhas.
- Fica um registro para o grupo todo (`checkin_reports`): quem reportou, o motivo e a foto. Aparece no Feed como "🚩 cancelado por…".
- **Só na semana ainda aberta.** Semana fechada já virou multa e caixinha.
- Ninguém reporta o próprio treino (para isso existe Apagar).
- Quem teve o treino cancelado pode registrar outro no mesmo dia, passando de novo pela regra do GPS.
- Em grupo de 2 pessoas, o report é decisão de uma só. Se virar abuso, o caminho é exigir a concordância do autor ou de um dono do grupo.
- A foto cancelada continua guardada no armazenamento como prova; só o check-in some.
- Migração: `20261119000003_report_checkin.sql`. Teste do banco: `supabase/tests/04_reports.sql` (escrito, **não executado**: não há `psql` nesta máquina).

---

## Ordem sugerida

1. Avisar check-in repetido antes de abrir a câmera
2. Ligar o GPS só quando a regra estiver ativa
3. Mostrar erro ao carregar as academias
4. Pedido de revisão (funcionalidade)
5. Mapa na tela Academias

---

## Correções e melhorias de código

### 1. Avisar check-in repetido antes de abrir a câmera

- **Problema:** se a pessoa já treinou hoje, a câmera abre, ela tira a foto, e só ao tocar em "Registrar treino" o banco recusa com "Você já registrou o treino de hoje". **[Certa]**
- **Onde:** `src/pages/CheckinPage.tsx` (entrada da tela), `src/data/queries.ts` (`useCheckins`), `src/pages/HomePage.tsx` (botão "Fiz meu treino").
- **Como:** antes de navegar para `/check-in`, verificar se já existe check-in do usuário com `day === today`. Se existir, mostrar o aviso e não abrir a câmera. Repetir a checagem ao montar a tela de check-in, como segunda barreira.
- **Obs.:** a regra definitiva continua no banco (gatilho `checkins_before_insert`). Isto é só melhoria de experiência.

### 2. Ligar o GPS só quando a regra estiver ativa

- **Problema:** `CheckinPage` inicia a leitura de posição mesmo com `group.require_location = false`. **[Certa]**
- **Onde:** `src/pages/CheckinPage.tsx`, efeito que chama `watchPosition`.
- **Como:** não iniciar o acompanhamento quando a regra estiver desligada. Ajustar a faixa de aviso para não pedir localização nesse caso.
- **Ganho:** menos bateria e nenhum pedido de permissão de localização à toa.

### 3. Mostrar erro ao carregar as academias

- **Problema:** se `useGyms` falhar, `gyms.data` fica indefinido, a verificação `noGym` vira falsa e o botão de foto é liberado. A pessoa só descobre no envio. **[Certa]**
- **Onde:** `src/pages/CheckinPage.tsx` (`noGym`, `canShoot`, `LocationBanner`).
- **Como:** tratar `gyms.isError` como bloqueio, com a mensagem "Não consegui carregar as academias" e um botão para tentar de novo (`gyms.refetch()`).

### 4. Separar `CheckinPage` em hooks

- **Problema:** `CheckinPage.tsx` tem cerca de 280 linhas, misturando câmera, GPS, faixa de aviso e envio. **[Certa]**
- **Como:** extrair `useCamera(facing)` e `useGymCheck(gyms, required)`.
- **Prioridade:** baixa. Fazer junto com outra mudança na tela.

### 5. Testes de interface para o check-in

- **Estado:** existem testes das regras do app (`npm test`) e do banco (`npm run test:db`), mas nenhum de interface. O `PROGRESSO.md` já lista Playwright como próximo passo. **[Certa]**
- **Casos a cobrir:** perto (liberado), longe (bloqueado), sem academia, já treinou hoje, GPS negado.
- **Obs.:** a verificação manual foi feita no Chromium com localização simulada, mas o script usado não foi para o repositório.

### 6. Guardar a foto quando não há internet

- **Problema:** se o envio falhar no meio, a foto se perde e a pessoa precisa tirar outra. **[Certa]**
- **Como:** guardar o arquivo localmente (IndexedDB), junto com a posição e o horário, e reenviar quando a conexão voltar.
- **Cuidado:** a regra de um check-in por dia não pode gerar duplicata no reenvio.
- **Tamanho estimado:** médio. **[Provável]**

---

## Layout e telas

### 7. Mapa na tela Academias

- **Ideia:** mostrar as academias num mapa, com um círculo de 100 m em volta de cada uma.
- **Como:** Leaflet com os tiles do OpenStreetMap, que não exigem chave extra. A atribuição do OpenStreetMap precisa aparecer no mapa. **[Provável]**
- **Onde:** `src/pages/GymsPage.tsx`.
- **Decidido:** Leaflet (o Google Maps exigiria a chave paga).

### 8. Cor do botão de foto conforme a distância

- **Ideia:** botão cinza quando longe e verde quando perto, além da faixa de texto.
- **Onde:** `src/pages/CheckinPage.tsx` (botão "Tirar foto").

### 9. Histórico com cor por pessoa

- **Ideia:** cada treino no histórico com a cor do membro, para ver de relance quem treinou em cada dia.
- **Onde:** `src/pages/HistoryPage.tsx` e `src/pages/FeedPage.tsx`. A função `memberColor` já existe em `src/components/ui.tsx`.

### 10. Revisar a tela Início

- **Estado:** `HomePage.tsx` não foi analisado em detalhe. Antes de sugerir mudanças, abrir a tela, tirar uma captura de tela em tamanho de iPhone e rever.

---

## Funcionalidades novas

### 11. Pedido de revisão

- **Ideia:** se a verificação der "longe" ou GPS impreciso, a pessoa envia a foto para o parceiro aprovar.
- **Trade-off:** pode virar aprovação por consideração. O feed, em que os dois veem as fotos, já funciona como fiscalização mútua. **[Provável]**
- **Modelo sugerido:** campo de revisão em `checkins` (status e quem aprovou). Regra no banco: só outro membro do grupo aprova, e a aprovação fica marcada no registro.
- **Decisão pendente do casal:** a revisão conta como check-in normal? Entra na meta? Precisa de uma regra clara antes de implementar.

### 12. Cartão do resumo semanal

- **Ideia:** ao fechar a semana, gerar uma imagem com as fotos e o placar para compartilhar.
- **Como:** desenhar em canvas no cliente, a partir de `week_results`. O `prepareCheckinPhoto` em `src/lib/image.ts` serve de exemplo.
- **Cuidado:** as fotos são privadas. O cartão só sai do app se a pessoa decidir compartilhar.

### 13. Reações nas fotos

- **Ideia:** um emoji por foto, por pessoa.
- **Modelo sugerido:** tabela `reactions` (check-in, usuário, emoji), com a mesma segurança (RLS) das outras tabelas: só membros do grupo.

### 14. Tipo de treino opcional

- **Ideia:** musculação, cardio, aula ou outro, marcado de forma opcional no check-in.
- **Modelo sugerido:** coluna `kind` em `checkins`, com valores permitidos por `check`. Não mexe nas regras de meta.

### 15. Lembrete por horário, não por localização

- **Ideia:** lembrete no fim do dia se a pessoa ainda não treinou.
- **Não usar localização para isso:** o casal prefere que o GPS só seja usado na tela de check-in. **[Certa]**
- **Depende de:** notificações push (já no backlog de prioridade 2 do `PROGRESSO.md`).

---

## Não recomendado por enquanto

- **Verificar proximidade em segundo plano** (lembrete ou aviso por GPS fora da tela de check-in). Conflita com a preferência de usar a localização só durante o check-in.
