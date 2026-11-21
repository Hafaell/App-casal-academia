# Melhorias para o casal: o que construir e quando

Criado em 19/11/2026. Este arquivo reúne as ideias para tornar o app mais valioso para casais (e, por consequência, mais fácil de vender). **Leva 1 pronta em 20/11/2026: F4, F2 e F1 (sem o vídeo)**, ver [plano-leva-1.md](./plano-leva-1.md). **Leva 2 pronta em 21/11/2026: F3, F5 e F6**, ver [plano-leva-2.md](./plano-leva-2.md). A ideia é decidir, item por item, o que entra agora e o que fica para depois.

Ele é separado do [MELHORIAS.md](./MELHORIAS.md), que guarda as melhorias técnicas anteriores, e complementa o [app-comerciavel.md](./app-comerciavel.md) (lojas, custos, segurança) e o [PROGRESSO.md](./PROGRESSO.md) (estado do projeto).

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**. Esforço: **P** (pequeno, dias), **M** (médio, 1 a 2 semanas), **G** (grande, mais de 2 semanas). Os esforços são palpites **[Adivinhando]**.

---

## 1. Posicionamento: casal ou grupo?

**Recomendação [Provável]:** começar como app de **casal**, falando "treino a dois". A mesma tela de 2 pessoas serve para melhores amigos, irmãos e colegas de academia, sem o app deixar de falar com o casal. Grupos maiores ficam como expansão futura (o banco já guarda grupos).

| | **Casal (dupla)** | **Grupo de amigos** |
| --- | --- | --- |
| Mensagem de venda | Clara: "treinem juntos e se cobrem" | Genérica; concorre com apps de academia e de hábitos |
| Quem paga | Um só, pelos dois | Indefinido: quem paga pelo grupo? |
| Moderação e risco | Baixo: duas pessoas que se conhecem | Alto: mais fotos e textos, mais denúncia e bloqueio |
| Crescimento sozinho | **Fraco:** cada casal só convida o parceiro, que já está dentro **[Certa]** | **Forte:** cada pessoa traz amigos |
| Tamanho do mercado | Menor, com teto de receita | Maior |
| Complexidade | Baixa (o que já existe) | Alta: ranking, papéis, multa por pessoa |

- O ponto fraco do casal é o crescimento: a divulgação precisa vir de fora (Instagram e TikTok de casal, o cartão da semana compartilhável).
- Não pesquisei concorrentes. Antes de investir, vale ver nas lojas apps de "contrato de compromisso com dinheiro" e de treino em casal, para comparar preço e avaliações.

**Decisão:**

- [ ] Casal primeiro, "treino a dois" como mensagem (recomendado)
- [ ] Grupo de amigos desde o início
- [ ] Decidir depois do beta

---

## 2. Funções para o casal

Cada item tem uma caixa de decisão. Marque **Agora**, **Depois** ou **Não**.

### F1. Nossa história: relatório do mês e álbum do ano

- **O que é:** relatório mensal do casal (semanas batidas, dinheiro na caixinha, sequência, melhor dia e horário) e uma colagem ou vídeo do ano com as fotos de treino, para compartilhar.
- **Valor:** alto. Tem apelo emocional e vira divulgação gratuita.
- **Esforço:** relatório **M**; colagem estática **M** (parecida com o cartão da semana, que já existe); vídeo **G** (melhor no app nativo).
- **Banco:** não precisa de mudança, só lê check-ins e semanas fechadas.
- **Dá para fazer agora na web?** O relatório e a colagem, sim. O vídeo, só no nativo.
- **Decisão:** relatório: [x] Agora (**feito**) · colagem: [x] Agora (**feita**) · vídeo: [x] Depois

### F2. Caixinha com objetivo

- **O que é:** dar um destino ao dinheiro da caixinha (viagem, jantar, presente), com barra de progresso e valor-alvo. Opcional: gerar o "Pix copia e cola" com a chave de quem recebe, sem o dinheiro passar pelo app.
- **Valor:** alto. Responde à decisão pendente do `PROGRESSO.md` ("para que serve a caixinha") e dá sentido à multa.
- **Esforço:** **M** (objetivo e progresso); **M** a mais para o Pix copia e cola.
- **Banco:** tabela nova de objetivos (migração nova). Não mexe em `close_week`.
- **Cuidado:** o app nunca deve receber nem guardar o dinheiro; só registra e gera o código **[Certa]** (intermediar pagamento exigiria regras do Banco Central).
- **Decisão:** objetivo: [x] Agora (**feito**) · Pix copia e cola: [x] Não (feito e retirado em 20/11/2026)

### F3. Roleta de prêmios

- **O que é:** hoje o app só tem punição. Quando o casal bate uma marca (ex.: 4 semanas seguidas), uma roleta sorteia um **prêmio** (jantar escolhido pelo outro, massagem, folga de tarefa).
- **Valor:** alto. Dá o lado bom que falta e resolve a pendência "recompensa quando os dois batem a meta".
- **Esforço:** **G**.
- **Banco:** se o prêmio virar uma obrigação registrada, o sorteio deve ser feito no banco, como a multa (mexe em `close_week` ou numa função nova). Se for só diversão no app, é mais simples **[Provável]**.
- **Regra de dinheiro?** Não, desde que o prêmio não altere multa nem meta.
- **Decisão:** [x] Agora (**feito**: um giro a cada 2 semanas seguidas, sorteio no banco)

### F4. Treino juntos

- **O que é:** se os dois fazem check-in no mesmo dia e na mesma academia, conta como "treino a dois" e entra em estatística e prêmio ("vocês treinaram juntos 12 vezes").
- **Valor:** alto. Nenhum app genérico faz isso, e o GPS que o app já usa torna a conferência fácil. É o diferencial real do produto.
- **Esforço:** **M**.
- **Banco:** pode ser só uma consulta sobre check-ins existentes.
- **Atenção:** se o "treino a dois" valer um treino a mais para a meta, vira **regra de dinheiro** (mexe em `close_week`, `rules.ts` e `supabase/tests/01_rules.sql`). A opção segura é só estatística e prêmio.
- **Decisão:** [x] Agora (**feito**, só estatística: mesmo dia, até 200 m e até 3 h)

### F5. Planejar a semana e cutucar o parceiro

- **O que é:** calendário compartilhado de quando cada um pretende treinar, lembrete antes do horário e um botão "vamos?" que avisa o outro.
- **Valor:** alto para retenção. É o que cria hábito diário.
- **Esforço:** **M** sem notificações; **G** com notificações (exige push).
- **Banco:** tabela nova de planos (migração nova).
- **Depende de push:** no PWA do iPhone o push exige o app instalado e a Edge Function; no app nativo é mais confiável.
- **Decisão:** [x] Agora, sem push (**feito**: aviso dentro do app) · com push: depois

### F6. Exceção com aprovação do parceiro

- **O que é:** a exceção (doença, viagem, lesão) só vale depois que o outro aprova. O `PROGRESSO.md` já aponta que, sem limite, a exceção pode virar abuso.
- **Valor:** médio a alto. Fortalece a confiança entre os dois.
- **Esforço:** **M** a **G**.
- **Regra de dinheiro: SIM.** Muda o gatilho de exceção e o `close_week` (só contar as aprovadas), o `rules.ts` precisa ficar idêntico, e `supabase/tests/01_rules.sql` precisa ser atualizado. Migração nova, sem editar as antigas.
- **Decisão:** [x] Agora (**feito**: o parceiro pode recusar até 23h59 do dia em que foi marcada; sem resposta, vale)

### F7. Treino automático pelo relógio (Apple Saúde e Google Health Connect)

- **O que é:** se o celular ou o relógio já registrou o treino, o app aceita sem foto.
- **Valor:** alto como diferencial, mas é a função mais pesada.
- **Esforço:** **G**.
- **Só no app nativo.** Mexe em dado de saúde, que a LGPD trata como sensível **[Certa]**, e exige consentimento claro e declaração nos formulários das lojas.
- **Decisão:** [ ] Agora [ ] Depois [ ] Não

### F8. Desafios do mês

- **O que é:** meses temáticos ("mês do cardio", meta mais alta, prêmio extra).
- **Valor:** médio. Ajuda a variar e a manter o interesse.
- **Esforço:** **G**. Meta diferente por mês mexe na regra de dinheiro.
- **Decisão:** [ ] Agora [ ] Depois [ ] Não

### F9. Aposta entre os dois

- **O que é:** desafio pontual (quem perder paga o jantar).
- **Valor:** médio.
- **Esforço:** **G**.
- **Cuidado:** use a palavra "desafio", não "aposta". A Apple e o Google têm regras rígidas sobre jogos de azar, e o app já tem uma roleta. Evite visual de cassino.
- **Decisão:** [ ] Agora [ ] Depois [ ] Não

### F10. Parcerias (academias, restaurantes, suplementos)

- **O que é:** cupons e benefícios dados por parceiros, sem cobrar mais do casal.
- **Valor:** receita extra e razão para assinar. **[Adivinhando]** que funcione, pois depende de ter base de usuários.
- **Esforço:** é trabalho de negócio, não de código.
- **Decisão:** [ ] Agora [ ] Depois [ ] Não

### F11. Fotos de evolução (antes e depois)

- **O que é:** área privada para registrar o corpo ao longo do tempo.
- **Valor:** costuma vender bem, mas é dado sensível e pode ultrapassar o que a Apple aceita se não houver cuidado.
- **Esforço:** **M**.
- **Só com consentimento claro e em área privada**, nunca no feed.
- **Decisão:** [ ] Agora [ ] Depois [ ] Não

---

## 3. Resumo para decidir

| # | Função | Valor | Esforço | Regra de dinheiro? | Banco novo? | Só nativo? |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Relatório e álbum | Alto | M a G | Não | Não | Só o vídeo |
| F2 | Caixinha com objetivo | Alto | M | Não | Sim | Não |
| F3 | Roleta de prêmios | Alto | G | Não (se não alterar multa) | Provável | Não |
| F4 | Treino juntos | Alto | M | Só se mudar a meta | Não | Não |
| F5 | Planejar semana e cutucar | Alto | M a G | Não | Sim | Push é melhor no nativo |
| F6 | Exceção com aprovação | Médio a alto | M a G | **Sim** | Sim | Não |
| F7 | Treino pelo relógio | Alto | G | Não | Provável | **Sim** |
| F8 | Desafios do mês | Médio | G | Sim | Sim | Não |
| F9 | Desafio entre os dois | Médio | G | Sim | Sim | Não |
| F10 | Parcerias | Variável | Negócio | Não | Não | Não |
| F11 | Fotos de evolução | Médio | M | Não | Sim | Não |

### Ordem que eu seguiria [Provável]

1. **F4 (treino juntos)** e **F2 (caixinha com objetivo)**: dão a cara do produto e não mexem na multa.
2. **F1 (relatório mensal e colagem)**: reaproveita o que já existe e dá divulgação.
3. **F3 (roleta de prêmios)**: o lado bom do app.
4. **F5 (planejar a semana)**: sem push no começo, com push quando o app nativo existir.
5. **F6 (exceção com aprovação)**: antes de abrir para mais gente, por causa do abuso.
6. Depois do lançamento: F7, F8, F9, F10, F11.

---

## 4. Construir agora na web ou esperar o app nativo?

O app de loja será em React Native (decisão do [app-comerciavel.md](./app-comerciavel.md), seção 3). Isso muda o que vale construir agora:

- **Reaproveita-se no app nativo:** migrações do banco, regras em `src/domain/` e a lógica de `src/data/queries.ts`. Funções cuja maior parte é banco e regra (F2, F3, F4, F6) são seguras de fazer agora.
- **Será reescrito no app nativo:** as telas. Cada tela nova feita na web agora será refeita depois. Isso é um custo real **[Certa]**.
- **Opção A (recomendada [Provável]):** fazer agora **o banco e as regras** das funções escolhidas, com testes, e uma tela simples na web para o casal usar e validar. As telas nativas viram trabalho da migração.
- **Opção B:** esperar o app nativo e construir tudo lá. Evita retrabalho, mas o casal não usa nada novo por 2 a 3 meses.
- **Opção C:** construir tudo na web agora, com telas completas, e refazer na migração. Mais rápido para validar, com retrabalho.

**Decisão:** [ ] A [ ] B [ ] C

---

## 5. Cuidados

- **Funções não substituem o uso.** O que mais pesa na cobrança é o casal continuar treinando no segundo e terceiro mês. Acompanhe uma só medida: quantos casais seguem ativos na oitava semana.
- **Não construa tudo antes de saber se pagam.** Faça uma lista de espera, mostre o app a casais do beta e pergunte: "você pagaria R$ 49,90 por ano?"
- **Mudou regra de dinheiro: mude os dois lados.** Alterações em multa, meta, exceção ou coringa exigem mudar o banco (`close_week` e gatilhos) **e** `src/domain/rules.ts`, e atualizar `supabase/tests/01_rules.sql` **[Certa]**. Nunca edite uma migração já aplicada; crie um arquivo novo.
- **Dados de saúde (F7, F11, e a exceção por doença ou lesão)** são sensíveis pela LGPD. Peça consentimento claro e minimize o que é guardado.
- **Linguagem nas lojas:** evite "aposta" e visual de cassino na roleta e nos desafios.
- **Quem paga e sai do grupo:** se a assinatura é do casal e quem pagou sai, o que acontece com o Premium? Definir antes de cobrar.

---

## 6. Como usar este arquivo

1. Marque as decisões acima (posicionamento, cada função e a opção A, B ou C da seção 4).
2. Com as decisões marcadas, peça para montar o plano de construção da primeira leva, com migrações, regras e testes.
3. Ao terminar cada função, registre no `PROGRESSO.md` e marque aqui como feita.
