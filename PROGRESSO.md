# Treino a Dois: progresso do projeto

Este arquivo é o ponto de partida de toda nova sessão. Ele diz onde o projeto está, o que falta e para onde queremos ir.

Última atualização: 19/11/2026 · Branch de trabalho: `develop` · Versão do app: 0.1.0

Instruções para sessões do Claude Code ficam no [CLAUDE.md](./CLAUDE.md).

Legenda de confiança nas afirmações não óbvias: **[Certa]**, **[Provável]**, **[Adivinhando]**.

---

## 1. Visão do produto

App para o casal (Rafael e a namorada) não desanimar da academia.

- Cada um treina **4 vezes por semana** (segunda a sábado; sábado é opcional; domingo é folga).
- Cada treino se prova com **uma foto tirada na hora**, sem galeria.
- Domingo às 23h59 a semana fecha. Quem não bateu a meta recebe **uma multa sorteada (R$10 a R$50) e uma punição da roleta**. Se os dois falham, pagam o mesmo.
- Exceções (doença, viagem, lesão, menstruação) reduzem a meta em 1 por dia útil. Cada pessoa tem **1 coringa por mês** que cancela a punição de uma semana inteira.
- O dinheiro vai por **Pix manual**; o app só registra quem deve e quanto já entrou.
- **Futuro:** grupos de amigos com regras próprias (meta, faixa de multa, roleta) e ranking.
- Plataforma: **iPhone, sem Mac**, como PWA instalado na tela inicial.

---

## 2. Onde estamos agora

**No ar desde 15/11/2026 em https://treino-a-dois-theta.vercel.app, com o Supabase de produção criado, configurado e validado. Falta instalar no iPhone e fazer o primeiro uso.**

### Pronto

| Área | Status |
| --- | --- |
| Login por e-mail e senha, criação de grupo, convite por código ou link | Feito |
| Check-in por câmera ao vivo, com carimbo de dia, hora e grupo na foto | Feito |
| Início: placar da semana dos dois, dias restantes, botão "Fiz meu treino" | Feito |
| Feed: check-ins, exceções, coringas e semanas fechadas | Feito |
| Histórico: calendário com miniaturas e resumo das semanas | Feito |
| Sequência: semanas seguidas de cada um e do casal | Feito |
| Caixinha: saldo, dívidas, marcar multa paga e punição cumprida | Feito |
| Roleta: adicionar, editar, pausar e remover punições | Feito |
| Exceções e coringa do mês | Feito |
| Verificação de localização: academias do grupo (link colado do Google Maps, posição atual ou busca com chave do Google), check-in só a até 100 m, conferido no banco; botão Excluir | Feito, **não testado no iPhone**. A busca com chave do Google não foi ativada (sem chave) |
| Grupo e regras: meta, faixa de multa, domingo, coringas por mês, convite, nome | Feito |
| Banco com regras e segurança (RLS) em todas as tabelas e nas fotos | Feito |
| Reações nas fotos, tipo de treino opcional, cartão da semana para compartilhar, mapa das academias, reportar treino de outro membro (cancela) | Feito em 19/11/2026, **não testado no iPhone**. Detalhes e decisões em [MELHORIAS.md](./MELHORIAS.md) |
| Fechamento automático da semana (função no banco + agendamento + rede de segurança no app) | Job agendado e ativo no Supabase real; **o primeiro fechamento real ainda não aconteceu** |
| PWA: manifesto, ícones, service worker | Gerado no build, **não testado num iPhone real** |
| Projeto Supabase de produção (`treino-a-dois`, São Paulo) com as 3 migrações | Feito em 15/11/2026 |
| Publicação na Vercel (projeto `treino-a-dois`, time `hafael1`, plano Hobby) | Feito em 15/11/2026, pela CLI |

### Como foi verificado

- Localização: testes do banco em `supabase/tests/02_location.sql` e telas abertas no Chromium com GPS simulado.
- Regras do banco: testes em Postgres local imitando o Supabase (`npm run test:db`). Passaram em 13/11. Não foram repetidos em 15/11 porque a máquina atual não tem `psql`.
- Regras do app: 28 testes (`npm test`). Passaram.
- `npm run typecheck` e `npm run build` passam (Node 26, npm 11).
- **Supabase real (15/11/2026):** `npm run test:e2e` passou nos 53 passos: cadastro e login, perfil criado pelo gatilho, grupo e convite, envio e leitura de foto pelo Storage, check-in com dia e usuário definidos pelo servidor, bloqueio de domingo, um check-in por dia, exceção, coringa, edição de regras e roleta, `catch_up_weeks`, e o isolamento (quem não é do grupo não vê dados nem fotos; `close_week` não é exposta).
- Consulta no banco confirmou: 9 tabelas com RLS ligado em todas, bucket `checkins` privado com 3 policies, 20 policies nas tabelas, job `fechar-semanas` ativo (`59 * * * *`).
- Telas: build de produção servido em `localhost` contra o Supabase real. Cadastro, criação de grupo, Início, Feed, Histórico, Caixinha, Roleta, Grupo e regras, Exceções e Sequência abriram sem erro no console. Os dados de teste foram apagados.

### Não verificado ainda

- Câmera ao vivo no iPhone dentro do app instalado. **[Provável]** que funcione no iOS 16.4 ou mais novo; só dá para confirmar num aparelho real. A tela de check-in não foi exercitada no computador (o teste enviou a foto direto pela API).
- O primeiro fechamento real pelo `pg_cron` (domingo às 23h59). O job existe e está ativo, mas ainda não fechou nenhuma semana de verdade.
- GPS dentro da academia no iPhone (precisão em ambiente fechado) e a busca no Google Maps com chave real.
- O app instalado no iPhone. O endereço publicado foi conferido só pelo computador: páginas, manifesto, service worker e ícones respondem, e a tela de login abre sem erro no console.

---

## 3. O que você precisa fazer para colocar no ar

> Roteiro completo e atualizado, na ordem certa, com conferências e solução de problemas: [DEPLOY.md](./DEPLOY.md). A lista abaixo é o resumo original.

Estes passos dependem de contas e acessos seus. Na ordem:

### A. Supabase (banco, login, fotos)

Feito em 15/11/2026. Projeto `treino-a-dois` (ref `hyxvesqvvhueaigclpbl`, São Paulo), na organização "Hafael".

- [x] Projeto criado no plano gratuito. URL e anon key gravadas no `.env.local` (fora do git).
- [x] `pg_cron` ativado (a própria migração de agendamento cria a extensão).
- [x] As 3 migrações aplicadas, em ordem, pelo SQL Editor.
- [x] **Confirm email desligado.** O cadastro já entra direto. Para religar: Authentication > Sign In / Providers.
- [x] *Site URL* em **Authentication > URL Configuration** aponta para `https://treino-a-dois-theta.vercel.app`.
- [x] Job `fechar-semanas` conferido: existe e está ativo.
- [x] **Migração 4 (GPS):** `20261116000001_gym_location.sql` aplicada pelo SQL Editor em 18/11/2026 e conferida. Site republicado com o GPS pela CLI no mesmo dia.

A senha do banco foi gerada pelo painel e não foi guardada. Se precisar (CLI ou `psql`), redefina em Project Settings > Database.

### B. Vercel (hospedagem)

Feito em 15/11/2026. Endereço de produção: **https://treino-a-dois-theta.vercel.app**

- [x] Conta na Vercel criada com o GitHub (usuário `hafaell`, time `hafael1`).
- [x] Projeto `treino-a-dois` criado e publicado **pela CLI**, a partir da pasta local (`npx vercel deploy --prod`).
- [x] Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` cadastradas em Production e Preview.
- [x] **GitHub ligado ao projeto** em 19/11/2026: push na `main` publica em produção; push em outras branches gera Preview.
- [ ] Opcional: variável `VITE_GOOGLE_MAPS_API_KEY` (busca de academias pelo nome no Google Maps).
- [x] Branch de produção: `main`. Fluxo: trabalhar na `develop` e levar para a `main` para publicar.
- [x] **Migração 9 (academias por pessoa):** `20261119000005_gyms_per_person.sql` aplicada em 19/11/2026 e conferida.
- [x] **Migrações 6 e 7** (`20261119000002_reactions_and_kind.sql` e `20261119000003_report_checkin.sql`) aplicadas pelo SQL Editor em 19/11/2026 e conferidas por consulta (RLS, permissões e emojis).
- [x] **Migração 5 (raio 100 m):** `20261119000001_gym_radius_100.sql` aplicada pelo SQL Editor em 19/11/2026 e conferida (`gym_radius_m()` = 100).

### C. iPhone (instalar como app)

- [ ] iPhone com **iOS 16.4 ou mais novo** **[Certa]** (necessário para notificações e PWA completo; a instalação em si funciona em versões um pouco mais antigas).
- [ ] Abrir **https://treino-a-dois-theta.vercel.app** no **Safari** (precisa ser o Safari, não o Chrome do iPhone).
- [ ] Compartilhar > **Adicionar à Tela de Início**.
- [ ] Abrir pelo **ícone da tela inicial**, não pelo Safari. Só assim o app roda em tela cheia.
- [ ] No primeiro check-in, permitir o acesso à câmera e à localização ("Durante o Uso"). Se negar sem querer: Ajustes > Safari > Câmera (ou Ajustes > o app).
- [ ] Os dois precisam fazer isso, cada um no seu iPhone.

### D. Primeiro uso

- [ ] Uma pessoa cria a conta e o grupo.
- [ ] Em **Mais > Grupo e regras**, tocar em **Compartilhar** e mandar o convite.
- [ ] A outra cria a conta e entra com o código (ou abre o link).
- [ ] Cadastrar a academia em **Mais > Academias**. Sem academia, o check-in fica bloqueado (ou desligue a regra em Grupo e regras).
- [ ] Conferir a roleta e a faixa de multa. Dá para editar tudo no app.
- [ ] A meta só começa a valer na **segunda-feira seguinte** à criação do grupo (ou no mesmo dia, se for segunda).

### E. Teste de ponta a ponta (antes de depender do app)

- [ ] Fazer um check-in de verdade e ver se aparece no feed do outro celular.
- [ ] Marcar uma exceção e usar o coringa; desfazer o coringa.
- [ ] Esperar o primeiro domingo às 23h59 e conferir se a semana fechou sozinha e a multa apareceu na Caixinha. Se não fechar, o app tenta fechar quando for aberto (`catch_up_weeks`); ver "Riscos conhecidos".

---

## 4. Versões e padrões do projeto

### Ambiente

| Item | Versão |
| --- | --- |
| Node.js | 22.x (testado com 22.23) |
| npm | 10.x |
| PostgreSQL (Supabase) | 15 ou 17 gerenciado pelo Supabase; testado localmente com 16 |

### Dependências (conforme `package.json`)

| Pacote | Versão | Observação |
| --- | --- | --- |
| react, react-dom | 19.x | |
| react-router | 7.x | importar de `react-router`, não de `react-router-dom` |
| @tanstack/react-query | 5.x | |
| @supabase/supabase-js | 2.x | |
| vite | **7.x** | existe a 8, mas ver nota abaixo |
| @vitejs/plugin-react | 5.x | a 6.x exige Vite 8 |
| vite-plugin-pwa | 1.x | |
| tailwindcss, @tailwindcss/vite | 4.x | configuração em `src/index.css` (`@theme`), sem `tailwind.config` |
| typescript | ~5.9 | |
| vitest | 3.x | |

**Nota sobre versões [Provável]:** fiquei nas linhas Vite 7, Vitest 3 e TypeScript 5.9 porque eram as que eu conhecia bem e já combinavam entre si. Existem majors mais novas (Vite 8, Vitest 5, TypeScript 7). Atualizar é uma tarefa futura separada, uma biblioteca por vez, rodando `npm test`, `npm run typecheck` e `npm run build` a cada passo.

### Padrões de código

- Idioma: interface, mensagens de erro e comentários em **português do Brasil**. Nomes de código em inglês, exceto termos do domínio já usados (`caixinha`, `coringa`).
- TypeScript estrito. O alias `@/` aponta para `src/`.
- **Regras de negócio puras ficam em `src/domain/`** e têm teste. As telas não calculam meta nem sequência por conta própria.
- **Datas** são strings `AAAA-MM-DD` no fuso do grupo, nunca `Date` do aparelho para decidir "hoje". Usar `src/domain/dates.ts`.
- Acesso a dados só em `src/data/queries.ts` (hooks do React Query). Telas não chamam o Supabase direto.
- **Fonte da verdade das regras que valem dinheiro é o banco** (`close_week`, gatilhos de check-in, exceção e coringa). O cálculo em `src/domain/rules.ts` existe só para o placar ao vivo e **precisa continuar idêntico** ao do banco. Ao mudar uma regra, mude os dois e atualize `supabase/tests/01_rules.sql`.
- Estilos: Tailwind 4 com tokens em `src/index.css`. Estilos base ficam em `@layer base` (um estilo fora de camada sobrescreve os utilitários do Tailwind; já tivemos esse bug).
- Banco: **nunca editar uma migração já aplicada no Supabase**. Criar um arquivo novo `AAAAMMDDHHMMSS_descricao.sql`.
- Commits em português, descrevendo o que muda para o usuário.

### Comandos

```bash
npm run dev        # desenvolvimento
npm test           # regras do app
npm run typecheck
npm run build
npm run test:e2e   # ponta a ponta contra o Supabase real do .env.local (cria e limpa dados de teste)
DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db   # precisa de psql e de um Postgres VAZIO
```

---

## 5. O que falta fazer (backlog)

### Prioridade 1: pôr no ar e validar

- [x] Seção 3A: Supabase criado, migrado e validado.
- [x] Seção 3B: publicado na Vercel.
- [ ] Seções 3C a 3E: instalação no iPhone, primeiro uso e teste real.
- [x] Ligar o GitHub à Vercel para publicação automática (seção 3B).
- [ ] Testar a câmera no iPhone real, no app instalado e também no Safari. Se `getUserMedia` falhar no modo instalado, o plano B (câmera nativa via `<input capture>`) já existe, mas só confere a idade do arquivo.
- [ ] Confirmar que o `pg_cron` fecha a semana no domingo às 23h59 de Brasília. O job roda no minuto 59 de cada hora e a função só fecha quando já passou das 23h59 do domingo no fuso do grupo; verificar o primeiro fechamento real.
- [ ] Ajustar o que aparecer no uso real (texto, tamanhos, fluxo).

### Prioridade 2: melhorias já previstas no briefing

- [ ] **Lembretes por notificação** (o briefing deixou para depois). Exige push no PWA: iOS 16.4+, app instalado, permissão do usuário e um envio pelo servidor (Edge Function do Supabase + Web Push). Ideias: lembrete no fim do dia se ainda não treinou; aviso quando a semana fecha e há punição.
- [ ] **Aviso de fechamento**: hoje o resultado aparece como cartão na tela Início quando a pessoa abre o app. Sem push, ninguém é avisado sozinho.
- [ ] Decidir e implementar as pendências do briefing (seção 6).
- [x] Melhorias planejadas: quase todas feitas em 19/11/2026; o que ficou de fora (notificações, fila offline, Playwright, revisão da tela Início) está explicado em [MELHORIAS.md](./MELHORIAS.md).

### Prioridade 3: qualidade e manutenção

- [ ] Testes de interface (Playwright) para os fluxos principais: check-in, exceção, coringa, caixinha. Hoje só existem testes das regras.
- [ ] Integração contínua (GitHub Actions): `typecheck`, `test` e `build` a cada push; `test:db` com um Postgres de serviço.
- [ ] Tipos do banco gerados (`supabase gen types`) para trocar os tipos escritos à mão em `src/data/types.ts`.
- [ ] Funcionamento offline básico: hoje o app abre sem rede (service worker), mas os dados precisam de conexão.
- [ ] Atualizar dependências para as majors mais novas, uma por vez (seção 4).
- [ ] Revisão de segurança e de acessibilidade (contraste, leitor de tela, textos alternativos das fotos).

### Prioridade 4: grupos de amigos e crescimento

O banco já guarda regras por grupo, então a base existe. Falta:

- [ ] Ranking do grupo (entra quando há mais de 2 pessoas).
- [ ] Papéis: hoje **qualquer membro edita as regras e a roleta**. Com amigos, só quem criou (owner) deveria poder. O campo `role` já existe na tabela `group_members`.
- [ ] Tela para o owner remover membros e trocar o código de convite (hoje o código nunca expira).
- [ ] Telas de grupo com mais de 2 pessoas revisadas (placar, caixinha e feed foram pensados para 2).
- [ ] Decidir: uma multa sorteada por semana para todos que falharam (como hoje) ou por pessoa, quando o grupo for grande.
- [ ] Lojas (App Store e Google Play): plano completo, custos e a ordem econômica de gastos em [app-comerciavel.md](./app-comerciavel.md). Decisão de 19/11/2026: app nativo em React Native com Expo.
- [ ] Funções para o casal (treino juntos, caixinha com objetivo, roleta de prêmios, relatório mensal e outras), com decisão de o que entra agora ou depois, em [melhorias-casal.md](./melhorias-casal.md).

---

## 6. Decisões pendentes (do briefing) e como estão resolvidas hoje

| Pendência | Situação atual | Decidir |
| --- | --- | --- |
| Para que serve o dinheiro da caixinha | O app só controla quanto entrou e quanto cada um deve | Vocês: date, viagem, presente? |
| Multa por semana ou por treino faltante | **Por semana**, um valor sorteado | Mudar exige alterar `close_week` |
| Exceção reduz a meta em 1? Limite por mês? | Reduz 1 por dia útil, **sem limite mensal**; não reduz se a pessoa treinou naquele dia | Pode virar abuso. Vale pôr um limite? |
| Treino no domingo conta | **Não** (check-in bloqueado); configurável em Grupo e regras | Confirmar |
| Registrar a localização da academia | **Sim**, até 100 m de uma academia do grupo (era 300 m até 19/11/2026); desligável por grupo | Ajustar o raio se o GPS indoor atrapalhar (`gym_radius_m()` no banco e `GYM_RADIUS_M` no app) |
| Recompensa quando os dois batem a meta | **Não** existe | Ex.: 4 semanas seguidas dão um prêmio da caixinha |
| Nome do app | "Treino a Dois" (provisório) | Definir; trocar em `vite.config.ts`, `index.html` e `public/favicon.svg` |
| Branch `main` | **Produção na Vercel** desde 19/11/2026; `develop` é a branch de trabalho | Levar `develop` para `main` por PR ou avanço direto |
| Confirmação de e-mail no cadastro | **Desligada** (decidido em 15/11/2026, para o uso do casal) | Religar se abrir para amigos |

---

## 7. Riscos e limitações conhecidos

- **A foto "tirada na hora" não é garantida de forma absoluta [Certa].** A câmera ao vivo (`getUserMedia`) não deixa escolher da galeria, e a data e hora vêm do servidor. O plano B com câmera nativa só checa que o arquivo foi modificado nos últimos 5 minutos, o que dá para burlar. Para um casal, o parceiro vendo o feed é o fiscal real, como o briefing diz.
- **GPS dá para falsificar [Certa].** Apps de localização falsa (mais comuns no Android) enganam a verificação. O banco impede só o atalho de mandar check-in sem passar pelo GPS do aparelho. Dentro de prédio o GPS pode errar 50 m ou mais. O raio é 100 m (pedido do usuário em 19/11/2026) e o banco recusa leituras com margem acima de 500 m; se check-ins verdadeiros forem recusados, avaliar subir o raio ou cadastrar a academia por "Estou na academia agora", que é o jeito mais preciso.
- **Academias por pessoa (desde 19/11/2026).** Cada um cadastra as suas, o check-in só vale perto das suas e só quem cadastrou exclui (migração `20261119000005_gyms_per_person.sql`). Ainda dá para cadastrar a própria casa como academia; o parceiro vê as academias de todos na lista e pode reportar o treino.
- **Projeto gratuito do Supabase pausa após cerca de 7 dias sem uso [Provável].** Num app usado todo dia isso não deve acontecer, mas se pausar o fechamento da semana não roda. Abrir o painel e reativar resolve.
- **O fechamento depende do `pg_cron`.** Se o agendamento falhar, qualquer membro que abrir o app dispara `catch_up_weeks`, que fecha as semanas vencidas. A função é idempotente (rodar duas vezes não duplica nada).
- **Fuso horário:** o grupo guarda o fuso de quem o criou (`America/Sao_Paulo` por padrão). Viagem para outro fuso não muda a regra do grupo.
- **Qualquer membro marca a multa como paga**, sem confirmação de quem recebe. Combinado entre o casal, não há trava.
- **Quem sai do grupo** deixa de aparecer nos próximos fechamentos; o histórico já fechado continua.
- **iOS é mais restrito que Android para PWA:** o app precisa estar instalado na tela inicial para notificações e para o armazenamento ficar estável. Se o iPhone ficar muitas semanas sem abrir o app, o iOS pode limpar dados locais (login incluído). Os dados em si ficam no Supabase.
- **Fotos:** cada uma sai com cerca de 100 a 300 KB (máx. 1280 px). O plano gratuito do Supabase tem 1 GB de armazenamento **[Provável]**, o que dura bastante para duas pessoas, mas vale acompanhar. Ideia futura: apagar fotos com mais de X meses.

---

## 8. Onde queremos chegar

1. **Curto prazo:** o casal usa o app todo dia, a semana fecha sozinha no domingo e a caixinha reflete a realidade.
2. **Médio prazo:** lembretes por notificação, sequência e histórico como motivação, regras ajustadas pelo uso real.
3. **Longo prazo:** grupos de amigos com convite, regras próprias, ranking e papéis de dono; possivelmente app nativo na App Store.

---

## 9. Mapa do repositório

```
PROGRESSO.md              este arquivo
CLAUDE.md                 instruções e contexto para o Claude Code
README.md                 guia de instalação e decisões provisórias
scripts/e2e-supabase.mjs  teste de ponta a ponta contra o Supabase real
DEPLOY.md                 passo a passo para colocar em produção
MELHORIAS.md              melhorias planejadas, com contexto e ordem sugerida
src/domain/               regras puras e testes (datas, meta, exceções, sequência)
src/data/                 consultas ao Supabase (React Query) e tipos
src/app/                  login e grupo atual (contextos)
src/components/           layout com abas e componentes de interface
src/pages/                uma tela por arquivo
src/lib/                  cliente Supabase, tratamento de foto, convites
supabase/migrations/      esquema, fotos (Storage) e agendamento (pg_cron)
supabase/tests/           testes das regras do banco (01) e da localização (02)
public/                   ícones do app
vite.config.ts            configuração do Vite e do PWA (nome, cores, ícones)
vercel.json               redirecionamento das rotas para o app
```

### Tabelas do banco

`profiles`, `groups`, `group_members`, `gyms`, `punishments`, `checkins`, `exceptions`, `jokers`, `weeks`, `week_results`. Bucket de fotos: `checkins` (privado, caminho `grupo/usuário/arquivo.jpg`).

Funções principais: `create_group`, `join_group`, `leave_group`, `close_week`, `close_due_weeks`, `catch_up_weeks`, `set_debt_status`.

---

## 10. Como retomar numa nova sessão

1. Ler este arquivo e o `README.md`.
2. `git checkout develop && git pull`.
3. `npm install`, depois `npm test` e `npm run typecheck` para ver se o ambiente está saudável.
4. Dizer qual item do backlog (seção 5) atacar, ou o que apareceu no uso real.
5. Ao terminar, **atualizar este arquivo**: mover itens para "Pronto", ajustar o backlog e a data no topo.
