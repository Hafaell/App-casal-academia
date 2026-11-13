# Treino a Dois

App para o casal não desanimar da academia: cada um precisa fazer 4 treinos por semana (segunda a sábado), comprovados com foto tirada na hora. Quem não bate a meta recebe uma multa sorteada (R$10 a R$50) e uma punição da roleta.

> Estado do projeto, o que falta e o que fazer para colocar no ar: veja [PROGRESSO.md](./PROGRESSO.md).

É um web app instalável (PWA): abre no Safari do iPhone e vira um ícone na tela inicial, sem Mac e sem App Store.

## Estrutura

```
src/
  domain/      Regras puras (datas, meta, exceções, sequência) + testes
  data/        Acesso ao Supabase (React Query) e tipos
  app/         Login e grupo atual (contextos)
  components/  Layout com abas e componentes de interface
  pages/       Uma tela por arquivo
supabase/
  migrations/  Banco: tabelas, regras, segurança (RLS), fotos e agendamento
  tests/       Testes das regras do banco em Postgres puro
```

| Camada | Tecnologia |
| --- | --- |
| Front-end | React 19, TypeScript, Vite, Tailwind CSS 4, vite-plugin-pwa |
| Dados | Supabase: login, Postgres, Storage (fotos) e pg_cron (fechamento da semana) |
| Hospedagem | Vercel (plano gratuito) |

As regras que valem dinheiro ficam **no banco**, não no aparelho:

- A data e a hora do check-in vêm do servidor, no fuso do grupo.
- 1 check-in por pessoa por dia; domingo bloqueado (a não ser que o grupo libere).
- A semana é fechada pela função `close_week`, que calcula a meta com exceções e coringa, sorteia a multa e a punição e registra a dívida. O sorteio é um só por semana, então se os dois falharem pagam a mesma coisa.
- Semana fechada não pode ser alterada (apagar check-in, exceção ou coringa).
- Cada pessoa só envia fotos para a própria pasta, e só membros do grupo veem as fotos.

O app repete o cálculo da meta em `src/domain/rules.ts` só para mostrar o placar ao vivo.

## Como colocar no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito).
2. Em **Database > Extensions**, ative `pg_cron`.
3. Rode as migrações, em ordem, de `supabase/migrations/`. Dois jeitos:
   - Pelo painel: **SQL Editor**, cole e execute cada arquivo.
   - Pela CLI: `npx supabase init` (uma vez), `npx supabase link --project-ref SEU_REF` e `npx supabase db push`.
4. Em **Authentication > Sign In / Providers > Email**, deixe o login por e-mail ligado. Para o casal, o mais prático é desligar **Confirm email**; se deixar ligado, cada um confirma pelo link antes de entrar.

### 2. Rodar no computador

```bash
cp .env.example .env.local   # preencha com Project URL e anon key (Project Settings > API)
npm install
npm run dev
```

### 3. Vercel

1. Importe o repositório na Vercel (framework: Vite).
2. Em **Environment Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Faça o deploy. O `vercel.json` já redireciona as rotas para o app.

### 4. Instalar no iPhone

Abra o endereço da Vercel no **Safari** > botão Compartilhar > **Adicionar à Tela de Início**. Na primeira foto, permita o acesso à câmera.

### 5. Começar

1. Uma pessoa cria a conta e o grupo.
2. Em **Mais > Grupo e regras**, toque em **Compartilhar** e mande o convite.
3. A outra pessoa cria a conta e entra com o código (ou abre o link do convite).

A meta começa a valer na segunda-feira seguinte à criação do grupo (ou no mesmo dia, se for criado numa segunda). Antes disso os check-ins já aparecem no feed, sem punição.

## Testes

```bash
npm test                 # regras do app (datas, meta, sequência)
npm run typecheck
npm run build

# Regras do banco: precisa de um Postgres VAZIO (não use o banco do Supabase)
DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

O teste do banco cria um banco temporário, simula o mínimo do Supabase (auth, storage e papéis), aplica as migrações e confere: meta com exceções, domingo, sábado, coringa, multa igual quando os dois falham, fechamento idempotente, semana fechada imutável, caixinha e o isolamento entre grupos (RLS) nas tabelas e nas fotos.

## Decisões provisórias

O briefing deixou alguns pontos em aberto. Para não travar a primeira versão, escolhi o caminho mais simples e deixei o que dava configurável por grupo:

| Pendência | Como ficou | Onde mudar |
| --- | --- | --- |
| Multa por semana ou por treino faltante? | Um valor sorteado **por semana** | `close_week` no banco |
| Exceção reduz a meta em 1? Tem limite? | Reduz 1 por dia útil (seg a sex) justificado, **sem limite mensal**. Exceção em dia que a pessoa treinou não reduz | `close_week` e `rules.ts` |
| Treino no domingo conta? | **Não** por padrão, e o check-in fica bloqueado | Configurável em Grupo e regras |
| Registrar localização? | Não. A foto ganha um carimbo com dia, hora e nome do grupo | |
| Recompensa por sequência? | Não. A tela de Sequência mostra semanas seguidas de cada um e do casal | |
| Para que serve a caixinha? | Só controle: quanto entrou e quanto cada um deve | |
| Nome do app | "Treino a Dois" (provisório) | `vite.config.ts` e `index.html` |

Outras regras que defini:

- **Coringa:** só na semana atual, antes do fechamento. Pode desfazer enquanto a semana estiver aberta. Conta para o mês da segunda-feira da semana.
- **Exceção:** de segunda a sexta, da semana atual em diante (até 60 dias). Sábado não entra porque já é opcional.
- **Sequência:** semana salva pelo coringa não quebra a sequência, mas também não soma.
- **Quem entra no meio da semana** só tem meta a partir da segunda seguinte.
- **Punição:** a caixinha separa "multa paga" de "punição cumprida"; qualquer membro pode marcar.
- **Fechamento:** o `pg_cron` roda no minuto 59 de cada hora e fecha as semanas vencidas (no fuso de Brasília, cai às 23h59 de domingo). Ao abrir, o app também chama `catch_up_weeks` como rede de segurança.
