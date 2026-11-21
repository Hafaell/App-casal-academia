# Plano da leva 4: confirmação do pagamento, recuperar senha e exportar dados

Criado em 21/11/2026. Sugestão aceita pelo Rafael: itens 12, 22 e 24 da lista antiga. A lista nova, só com o que falta, está em [pendencias.md](./pendencias.md).

**Situação em 21/11/2026: código pronto e testado; migração do pagamento aplicada no Supabase** (conferida: coluna `paid_claimed_at` e função nova ativas). **A recuperação de senha ainda não funciona de verdade**: depende de um e-mail próprio (SMTP), explicado abaixo.

## Confirmação do pagamento da multa 💰

**Como funciona:** na Caixinha, quem deve toca em **"Já paguei"** e a multa fica "Aguardando confirmação" (o dinheiro ainda não entra na caixinha). O parceiro vê "Ana avisou que pagou em 21/11. Confira e confirme" e toca em **"Confirmar recebimento"**; só então conta como pago. Quem deve não consegue marcar a própria multa como paga nem desfazer a confirmação. Quem recebeu pode desfazer ("não recebi"). Se os dois deverem, cada um confirma o do outro. A punição continua podendo ser marcada por qualquer um.

**Regra de dinheiro:** `close_week` não muda. A caixinha (no app e na função `complete_kitty_goal`) já contava só `paid_at`, que agora só o parceiro preenche.

- [x] Migração `20261121000003_payment_confirmation.sql`: coluna `paid_claimed_at` e a função `set_debt_status` com a regra nova.
- [x] Teste do banco `08_payment_confirmation.sql`. **Rodou e passou** no Postgres local, junto com os testes 01 a 07 (o teste antigo de pagamento continuou passando).
- [x] App: botões novos na Caixinha.

## Recuperar senha

**Como funciona (sem link, funciona no Expo Go):** na tela de entrar, **"Esqueci a senha"** → a pessoa digita o e-mail → chega um **código de 6 números** → ela digita o código e a senha nova → já entra no app.

**Bloqueio encontrado em 21/11/2026 (conferido no painel):** o e-mail padrão do Supabase para "Reset password" traz **só um link, sem o código de 6 números**, e o painel **não deixa editar o modelo sem um e-mail próprio (SMTP)** ("Set up custom SMTP to edit templates"). Além disso, o e-mail grátis só chega para quem é da equipe do projeto **[Provável]** e tem limite de poucos por hora.

**Para destravar:** configurar um e-mail próprio (item 12 do [pendencias.md](./pendencias.md), por exemplo Resend, grátis, exige criar conta) e, em Authentication > Emails > Reset password, colocar o código no texto (`{{ .Token }}`). O app já está pronto para isso; nenhuma mudança de código será necessária.

- [x] App: telas "Esqueci a senha", código e senha nova; mensagens de erro em português (código vencido, muitos pedidos, senha igual).
- [ ] Ajustar o modelo do e-mail no Supabase: **bloqueado** até configurar o e-mail próprio (SMTP).

## Exportar meus dados (LGPD)

**Como funciona:** em Mais > **"Exportar meus dados"**. O app junta tudo o que é da pessoa (conta, grupos, treinos, exceções, coringas, semanas e multas, planos, chamadas do "vamos?", fotos de evolução e retiradas da caixinha) num arquivo `treino-a-dois-meus-dados.json` e abre o compartilhar do celular (salvar em Arquivos, mandar por e-mail). As fotos vão só pelo nome, para o arquivo não ficar enorme. Só entram dados da própria pessoa.

- [x] `fetchMyData` (queries), `buildDataExport` e `shareTextFile`, com teste de tela.

## Fechamento

- [x] Raiz: `npm test` (74) e typecheck. `mobile/`: `npm test` (38), typecheck, doctor (20/20) e export passam.
- [x] Migração aplicada no Supabase em 21/11/2026 e conferida.
- [x] Commit e push na branch `react-native` (21/11/2026).
