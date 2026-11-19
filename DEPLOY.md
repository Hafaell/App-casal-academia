# Treino a Dois: passo a passo para colocar a versão com GPS em produção

Siga na ordem. A ordem importa: o código novo já consulta a tabela `gyms` no banco, então o Supabase vem **antes** de publicar.

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**. Nomes de menus de Vercel, Supabase e Google Cloud mudam com o tempo; se algo não estiver onde está escrito, procure pelo nome da opção.

---

## De onde partimos

Informações tiradas do `CLAUDE.md` e do `PROGRESSO.md` da branch `develop` (15/11/2026). Confira se algo mudou desde então.

| Item | Estado |
| --- | --- |
| Supabase | Projeto `treino-a-dois` (ref `hyxvesqvvhueaigclpbl`, São Paulo). As **3 primeiras migrações já estão aplicadas**, pelo SQL Editor do painel (não pela CLI). |
| Login | "Confirm email" **desligado**. O *Site URL* já aponta para a Vercel. |
| Vercel | Projeto `treino-a-dois`, time `hafael1`, endereço `https://treino-a-dois-theta.vercel.app`. |
| Variáveis na Vercel | `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` já cadastradas em Production e Preview. |
| Como publica | Pela CLI (`npx vercel deploy --prod`), com a pasta local na branch `develop`. **O GitHub não estava ligado à Vercel** em 15/11, então push e merge **não publicavam sozinhos**. Se você ligou depois e a Vercel acompanha a `develop`, o merge nela publica: confirme em **Settings > Git > Production Branch**. |
| Onde está o código com GPS | Nas branches `claude/gracious-pascal-sle0t1` e `Vercel`. A `develop` (a branch de onde o site foi publicado) e a `main` **ainda não têm** o código novo. |

O que falta fazer:

| # | Onde | O que | Obrigatório? |
| --- | --- | --- | --- |
| 0 | Vercel e Supabase | Conferir se o código novo já foi ao ar sem a migração | Sim |
| 1 | Supabase | Rodar **só a 4ª migração** | Sim |
| 2 | Google Cloud | Criar a chave do Google Maps | Não (só para buscar a academia pelo nome) |
| 3 | Vercel | Cadastrar `VITE_GOOGLE_MAPS_API_KEY` | Não (acompanha o passo 2) |
| 4 | Computador | Publicar | Sim |
| 5 | iPhone | Cadastrar a academia e testar | Sim |

---

## 0. Conferir se o código novo já foi ao ar sem a migração

O site no ar foi publicado a partir da `develop`, que **não** tem o código com GPS. Então, o mais provável é que o site esteja funcionando normalmente, na versão antiga, e nada esteja quebrado. **[Provável]**

O risco existe só se a Vercel estiver acompanhando a branch `Vercel` (que já tem o código com GPS) ou a `claude/gracious-pascal-sle0t1`. Eu não consigo ver essa configuração daqui.

- [ ] Na Vercel, em **Deployments**, ver o último deploy de **Production**: qual branch e qual commit. Se for `develop` (ou um deploy da CLI) e não tiver o commit `94e386c` ou mais novo, o código novo **não** está no ar e você pode seguir com calma.
- [ ] Se o código novo estiver no ar, faça o passo 1 **agora**. Nada se perde nesse intervalo, só o check-in e as Academias dão erro.

---

## 1. Supabase: rodar a 4ª migração

As migrações 1 a 3 já estão aplicadas. Falta só:

- `supabase/migrations/20261116000001_gym_location.sql` (academias, posição no check-in e regra de 300 m)

### 1.1 Confirmar que ela ainda não foi rodada

No **SQL Editor** do painel do projeto `treino-a-dois`:

```sql
select to_regclass('public.gyms') as tem_academias;
```

- Resultado **vazio**: rode a migração (passo 1.2).
- Resultado `gyms`: já foi aplicada, pule para o 1.3.

### 1.2 Aplicar

- [ ] No **SQL Editor**, abra o arquivo, cole **todo** o conteúdo e execute (**Run**).
- [ ] **Não use `supabase db push`.** As migrações antigas foram aplicadas pelo painel, então a tabela de controle da CLI não existe e o comando tentaria aplicar tudo de novo. **[Certa]** (registrado no `CLAUDE.md`)
- [ ] **Nunca edite uma migração já aplicada.** Mudanças futuras viram um arquivo novo `AAAAMMDDHHMMSS_descricao.sql`.

### 1.3 Conferir

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'groups' and column_name = 'require_location';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'checkins'
  and column_name in ('lat', 'lng', 'accuracy_m', 'gym_id', 'gym_name', 'distance_m');
```

- [ ] A primeira consulta devolve 1 linha. A segunda devolve 6 linhas.

### 1.4 O que muda para quem já usa

- A regra **"Exigir estar na academia" vem ligada**, inclusive nos grupos que já existem. **[Certa]**
- Até alguém cadastrar uma academia (**Mais > Academias**), o check-in fica bloqueado com a mensagem "Cadastre a academia do grupo antes de registrar o treino".
- Se preferir não exigir por enquanto, desligue em **Mais > Grupo e regras > Exigir estar na academia**.

---

## 2. Google Cloud: chave do Google Maps (opcional)

**Sem esta chave o app funciona.** A busca pelo nome não aparece, e a academia é cadastrada pela posição atual, com a pessoa dentro dela. Dá para publicar sem a chave e fazer este passo depois.

- [ ] Em [console.cloud.google.com](https://console.cloud.google.com), criar um projeto (ou usar um existente).
- [ ] Ativar o **faturamento**. O Google exige cartão para usar o Maps, mesmo com cota gratuita. O uso de um casal costuma ficar dentro da cota. **[Provável]** Crie um **alerta de orçamento** para ser avisado se algo sair do normal.
- [ ] Em **APIs e serviços > Biblioteca**, ativar as duas:
  - **Maps JavaScript API**
  - **Places API (New)** (precisa ser a "New"; a antiga não serve)
- [ ] Em **APIs e serviços > Credenciais**, criar uma **Chave de API** e restringir:
  - **Restrições de aplicativo: Sites (referenciadores HTTP).** Adicione `https://treino-a-dois-theta.vercel.app/*` e, para testes no computador, `http://localhost:5173/*`.
  - **Restrições de API: Restringir chave**, marcando só as duas APIs acima.
- [ ] Copiar a chave (começa com `AIza`).

Por que restringir: a chave vai para o navegador (é como o Google Maps funciona na web) e qualquer pessoa pode vê-la. A restrição por site impede que outros a usem. **[Certa]** Evite liberar `*.vercel.app` inteiro: isso deixa qualquer projeto da Vercel usar a sua chave.

---

## 3. Vercel: variável da chave do Google

As variáveis do Supabase já estão cadastradas. Só falta esta, e só se você fez o passo 2.

- [ ] Em **Settings > Environment Variables** do projeto `treino-a-dois`, adicionar:

| Nome | Valor | Ambientes |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | a chave do passo 2 | Production (e Preview, se quiser testar por lá) |

- [ ] O nome está **exatamente** assim, com `VITE_` no início e sem espaços no valor. Sem o prefixo, o app não enxerga a variável. **[Certa]**

Variáveis `VITE_` entram **no momento do build**. Cadastrar a variável não muda o site no ar: só vale no próximo deploy (passo 4). **[Certa]**

---

## 4. Publicar

**Faça este passo só depois do passo 1.** Se publicar antes da migração, a tela de check-in e a de Academias dão erro.

### Opção A: pela CLI, como já é feito hoje

Primeiro leve o código com GPS para a `develop` (a branch de onde o site é publicado), de preferência por um **Pull Request** de `claude/gracious-pascal-sle0t1` para `develop`, para poder revisar. Depois, na pasta do projeto:

```bash
git checkout develop
git pull
npm install
npm test && npm run typecheck && npm run build
npx vercel deploy --prod
```

- [ ] Esperar o comando terminar e abrir `https://treino-a-dois-theta.vercel.app`.
- [ ] Se aparecer "Falta configurar o Supabase", confira em **Settings > Environment Variables** se as variáveis estão em **Production**.

A CLI publica **o que está na pasta**, não o que está no GitHub. Se a pasta estiver numa branch sem o código com GPS (por exemplo, a `develop` antes do merge, ou a `main`), o GPS **não** vai ao ar. **[Certa]**

### Opção B: publicar sozinho a cada push (recomendado a médio prazo)

Hoje cada atualização depende de rodar a CLI. Para a Vercel publicar sozinha:

- [ ] Em vercel.com/new > **GitHub** > instalar o aplicativo da Vercel no repositório `Hafaell/App-casal-academia`.
- [ ] Rodar `npx vercel git connect` na pasta do projeto.
- [ ] Em **Settings > Git > Production Branch**, escolher a branch de produção. Como a `develop` é a branch que você já usa para publicar, o caminho mais simples é mantê-la. A `main` existe, mas também **não tem** o código com GPS.
- [ ] Depois de ligado, cada push na branch de produção publica sozinho. Outras branches geram só um endereço de Preview.

Ao levar o código novo para a `develop`, o `PROGRESSO.md` provavelmente dará **conflito**: esta branch partiu da `develop` antes dos commits de 15/11 (que atualizaram esse mesmo arquivo). Resolva mantendo os dois lados.

### Depois de publicar

- [ ] No iPhone, o app instalado guarda uma cópia (service worker). Feche o app de verdade (deslizar para cima) e abra de novo; às vezes é preciso abrir duas vezes para pegar a versão nova.

---

## 5. Teste de ponta a ponta no iPhone

O iPhone precisa ter **iOS 16.4 ou mais novo**. **[Certa]** O app já deve estar instalado (**Safari > Compartilhar > Adicionar à Tela de Início**; abrir pelo ícone, não pelo Safari).

- [ ] **Mais > Academias**: cadastrar a academia (busca pelo nome, se tiver a chave; senão **Estou na academia agora**, de dentro dela).
- [ ] Os dois do casal enxergam a mesma academia na lista.
- [ ] **Fiz meu treino**: permitir a câmera e a localização ("Durante o Uso") quando o iPhone pedir.
- [ ] **Dentro da academia**: a faixa fica verde (por exemplo "📍 Smart Fit Centro · 40 m") e o botão de foto libera.
- [ ] **Longe da academia** (por exemplo em casa): a faixa fica vermelha com a distância e o botão de foto fica bloqueado.
- [ ] Registrar um treino e ver o check-in aparecer no **Feed** do outro celular, com o nome da academia.
- [ ] Confirmar que o GPS **não** fica ligado fora da tela de check-in (o ícone de localização some do topo do iPhone ao sair da câmera).

Se negar a câmera ou a localização sem querer: **Ajustes > Privacidade e Segurança > Serviços de Localização > Safari Websites** (ou o nome do app instalado), e marque "Durante o Uso". Para a câmera: **Ajustes > Privacidade e Segurança > Câmera**. **[Provável]** quanto ao nome exato dos menus, que variam com a versão do iOS.

---

## Atenção: o teste ponta a ponta antigo vai falhar

O script `npm run test:e2e` (que existe na `develop`, não nesta branch) cria check-ins pela API **sem localização**. Com a regra ligada por padrão, o banco passa a recusar esses check-ins ("Ative a localização para registrar o treino"). Antes de rodar o e2e de novo, ajuste o script para desligar `require_location` no grupo de teste, ou para cadastrar uma academia e enviar a posição. **[Provável]** (não li o script inteiro).

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Erro mencionando `gyms` ("relation does not exist") ou coluna `lat` | A migração 4 não foi rodada | Passo 1 |
| "Falta configurar o Supabase" ao abrir o site | Variáveis `VITE_SUPABASE_*` fora de Production, ou deploy feito sem elas | Conferir em Settings > Environment Variables e publicar de novo |
| Subi o código, mas o site não mudou | O GitHub não está ligado à Vercel, então o push não publica | Passo 4, opção A, ou ligar o GitHub (opção B) |
| Publiquei, mas o site não tem o GPS | A pasta local estava numa branch sem o código novo | Fazer o merge de `claude/gracious-pascal-sle0t1` na `develop`, `git checkout develop` e publicar de novo |
| "Ative a localização para registrar o treino" | Localização negada ou desligada no iPhone | Liberar em Ajustes |
| "Cadastre a academia do grupo antes de registrar o treino" | Nenhuma academia cadastrada | **Mais > Academias**, ou desligar a regra em Grupo e regras |
| "Você está a X m da academia mais próxima" | Fora do raio de 300 m, ou o GPS errou dentro do prédio | Chegar mais perto, ir para perto de uma janela e esperar o GPS. Se for constante, avaliar aumentar o raio (`gym_radius_m()` no banco e `GYM_RADIUS_M` em `src/domain/geo.ts`) |
| A busca "Buscar no Google Maps" não aparece | `VITE_GOOGLE_MAPS_API_KEY` não entrou no build | Cadastrar a variável e publicar de novo (passo 4) |
| A busca aparece, mas dá erro ao pesquisar | APIs não ativadas, ou o site fora da lista de referenciadores | Passo 2 |
| O app instalado mostra a versão antiga | Cópia guardada pelo service worker | Fechar o app de verdade e abrir de novo; se persistir, remover e reinstalar o atalho |

---

## Checklist final

- [ ] Conferi se o código novo já estava no ar e, se estava, rodei a migração logo (0)
- [ ] Migração `20261116000001_gym_location.sql` aplicada e conferida (1.2 e 1.3)
- [ ] Decidi se a regra de localização fica ligada ou desligada para o grupo (1.4)
- [ ] Chave do Google criada, com as duas APIs ativas e restrita ao site (2), **ou** decisão de deixar para depois
- [ ] `VITE_GOOGLE_MAPS_API_KEY` cadastrada na Vercel (3), se usar a chave
- [ ] Publicado **depois** da migração, a partir da branch com o código com GPS (4)
- [ ] Academia cadastrada e teste no iPhone feito: dentro libera, longe bloqueia, o feed mostra o treino (5)
