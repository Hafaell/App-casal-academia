# Treino a Dois

PWA para um casal manter a meta de 4 treinos por semana, com check-in por foto, multa sorteada e punição da roleta. Roda no iPhone pela tela inicial, sem Mac e sem App Store.

**Leia primeiro o [PROGRESSO.md](./PROGRESSO.md).** Ele é a fonte da verdade sobre o estado do projeto, o backlog, as decisões pendentes e os riscos. Ao terminar um trabalho, atualize-o (itens prontos, backlog e a data no topo). O [README.md](./README.md) explica a instalação e as regras de negócio.

## Comandos

```bash
npm run dev          # desenvolvimento (precisa do .env.local)
npm test             # 23 testes das regras em src/domain
npm run typecheck
npm run build        # tsc -b && vite build; gera o PWA em dist/
npm run test:e2e     # ponta a ponta contra o Supabase REAL do .env.local
npm run test:db      # regras do banco; precisa de psql e de um Postgres VAZIO
```

Antes de dizer que algo está pronto, rode `npm test`, `npm run typecheck` e `npm run build`.

## Arquitetura

- React 19, TypeScript estrito, Vite 7, Tailwind 4, vite-plugin-pwa. Alias `@/` aponta para `src/`.
- `src/domain/`: regras puras com teste (datas, meta, exceções, sequência). As telas não calculam meta nem sequência.
- `src/data/queries.ts`: único lugar que fala com o Supabase (hooks do React Query). As telas não chamam o Supabase direto.
- `src/pages/`: uma tela por arquivo. `src/app/`: contextos de login e grupo.
- `supabase/migrations/`: esquema, Storage e agendamento. `supabase/tests/`: testes do banco em Postgres puro.

## Regras que não podem ser quebradas

- **O banco é a fonte da verdade do que vale dinheiro** (`close_week` e os gatilhos de check-in, exceção e coringa). O cálculo em `src/domain/rules.ts` serve só para o placar ao vivo e precisa ficar idêntico ao do banco. Mudou uma regra: mude os dois e atualize `supabase/tests/01_rules.sql`.
- **Nunca edite uma migração já aplicada.** Crie um arquivo novo `AAAAMMDDHHMMSS_descricao.sql`. As três migrações atuais já estão aplicadas em produção.
- **Datas** são strings `AAAA-MM-DD` no fuso do grupo. Não use o `Date` do aparelho para decidir "hoje"; use `src/domain/dates.ts`.
- Estilos base ficam em `@layer base` em `src/index.css`. Um estilo fora de camada sobrescreve os utilitários do Tailwind.
- Importe de `react-router`, não de `react-router-dom`.
- Interface, erros e comentários em português do Brasil. Nomes de código em inglês, menos os termos do domínio (`caixinha`, `coringa`).
- Commits em português, descrevendo o que muda para o usuário. Branch de trabalho: `develop`.

## Infraestrutura

| Item | Valor |
| --- | --- |
| Supabase | projeto `treino-a-dois`, ref `hyxvesqvvhueaigclpbl`, região São Paulo (`sa-east-1`), organização "Hafael", plano gratuito |
| URL da API | `https://hyxvesqvvhueaigclpbl.supabase.co` |
| Hospedagem | Vercel (ver o estado no PROGRESSO.md) |
| Repositório | `Hafaell/App-casal-academia`, branches `develop` e `main` |

- `.env.local` (fora do git) guarda `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A chave anon é pública por desenho; a `service_role` nunca entra no projeto nem no front-end.
- A mesma organização do Supabase tem outro projeto, "Financeiro", que **não é deste app**. Não mexa nele.
- As migrações foram aplicadas **pelo SQL Editor do painel**, não pela CLI. Por isso a tabela de controle da CLI (`supabase_migrations.schema_migrations`) não existe: um `supabase db push` tentaria aplicar tudo de novo. Para migrações novas, use o SQL Editor ou registre as antigas antes com `supabase migration repair`.
- "Confirm email" está **desligado** em Authentication > Sign In / Providers. O cadastro já devolve a sessão.
- A senha do banco foi gerada pelo painel e não está guardada em lugar nenhum. Se precisar dela (CLI, `psql`), redefina em Project Settings > Database.
- O job `fechar-semanas` do `pg_cron` roda no minuto 59 de cada hora e chama `close_due_weeks()`.

## Ambiente desta máquina

- Windows 11, Node 26 e npm 11 (o projeto foi escrito com Node 22; testes e build passam nos dois).
- Não há `psql`, Docker, `gh`, CLI da Supabase nem CLI da Vercel instalados. `npm run test:db` não roda aqui sem instalar um Postgres.

## Teste de ponta a ponta

`npm run test:e2e` cria três contas `e2e-*@treinoadois-e2e.com` e um grupo `E2E ...` no Supabase real, exercita cadastro, convite, foto, check-in, exceção, coringa e o isolamento entre grupos, e no fim apaga fotos e check-ins. As contas e o grupo vazio ficam; remova pelo SQL Editor:

```sql
delete from public.groups where name like 'E2E %';
delete from auth.users where email like 'e2e-%@treinoadois-e2e.com';
```

Se rodar num domingo, o script também confere o bloqueio de check-in de domingo.
