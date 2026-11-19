# Deploy da versão com GPS: o que fazer para o app funcionar depois de enviar para a develop

Este arquivo tem um único objetivo: listar tudo o que você precisa fazer para o app funcionar, sem erro, com a verificação de academia por GPS, **depois que o código for para a sua branch `develop`**.

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**. Nomes de menus de Vercel, Supabase e Google Cloud mudam com o tempo; se algo não estiver onde está escrito, procure pelo nome da opção.

---

## Resumo: a ordem certa

| Ordem | Onde | O que | Obrigatório? |
| --- | --- | --- | --- |
| 1 | Supabase | Rodar a migração nova no SQL Editor | **Sim, antes de tudo** |
| 2 | Google Cloud | Criar a chave do Google Maps | Não (só para buscar a academia pelo nome) |
| 3 | Vercel | Cadastrar a variável `VITE_GOOGLE_MAPS_API_KEY` | Não (acompanha o passo 2) |
| 4 | GitHub | Enviar o código para a `develop` | Sim |
| 5 | Vercel ou CLI | Publicar | Sim |
| 6 | iPhone | Cadastrar a academia e testar | Sim |

**Por que essa ordem:** o código novo consulta a tabela `gyms` no banco. Se ele for ao ar antes da migração, a tela de check-in e a tela Academias dão erro. **[Certa]** E se o GitHub estiver ligado à Vercel, o simples envio para a `develop` já publica (veja o passo 5). Por isso os passos 1 a 3 vêm antes do 4.

---

## Informações do seu ambiente

Tiradas do `CLAUDE.md` e do `PROGRESSO.md` da `develop` (15/11/2026). Confira se algo mudou.

| Item | Valor |
| --- | --- |
| Supabase | Projeto `treino-a-dois`, ref `hyxvesqvvhueaigclpbl`, São Paulo |
| Migrações já aplicadas | As 3 primeiras (`20261113000001`, `..02`, `..03`), pelo SQL Editor do painel |
| Vercel | Projeto `treino-a-dois`, time `hafael1`, endereço `https://treino-a-dois-theta.vercel.app` |
| Variáveis já na Vercel | `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, em Production e Preview |
| Como o site era publicado | Pela CLI (`npx vercel deploy --prod`), com a pasta local na `develop`. Em 15/11 o GitHub **não** estava ligado à Vercel |
| Login | "Confirm email" desligado |

---

## 1. Supabase: rodar a migração nova

Falta aplicar **só uma** migração, a 4ª:

- `supabase/migrations/20261116000001_gym_location.sql` (academias, posição no check-in e regra de 300 m)

### 1.1 Ver se ela já foi aplicada

No **SQL Editor** do projeto `treino-a-dois`:

```sql
select to_regclass('public.gyms') as tem_academias;
```

- Resultado **vazio**: rode a migração (1.2).
- Resultado `gyms`: já foi aplicada, vá para o 1.3.

### 1.2 Aplicar

- [ ] Abra o arquivo, copie **todo** o conteúdo, cole no SQL Editor e clique em **Run**.
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

### 1.4 O que muda para quem já usa o app

- A regra **"Exigir estar na academia" vem ligada**, inclusive nos grupos que já existem. **[Certa]**
- Até alguém cadastrar uma academia (**Mais > Academias**), o check-in fica bloqueado com a mensagem "Cadastre a academia do grupo antes de registrar o treino".
- Se preferir não exigir por enquanto, desligue em **Mais > Grupo e regras > Exigir estar na academia**.

---

## 2. Google Cloud: chave do Google Maps (opcional)

**Sem esta chave o app funciona.** A busca pelo nome não aparece, e a academia é cadastrada pela posição atual, com a pessoa dentro dela. Dá para fazer este passo depois.

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

## 3. Vercel: cadastrar a variável da chave

As variáveis do Supabase já estão lá. Só falta esta, e só se você fez o passo 2.

- [ ] Em **Settings > Environment Variables** do projeto `treino-a-dois`, adicionar:

| Nome | Valor | Ambientes |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | a chave do passo 2 | Production (e Preview, se quiser testar por lá) |

- [ ] O nome está **exatamente** assim, com `VITE_` no início e sem espaços no valor. Sem o prefixo, o app não enxerga a variável. **[Certa]**

Variáveis `VITE_` entram **no momento do build**. Cadastrar a variável não muda o site no ar: só vale no próximo deploy (passo 5). **[Certa]**

---

## 4. Enviar o código para a develop

- [ ] Fazer o merge de `claude/gracious-pascal-sle0t1` (ou da branch `Vercel`, que tem o mesmo código) na `develop`, de preferência por um **Pull Request** no GitHub, para poder revisar.
- [ ] **Só faça isso depois dos passos 1 a 3.**
- [ ] Vai dar **conflito no `PROGRESSO.md`**: esta branch partiu da `develop` antes dos commits de 15/11, que atualizaram esse mesmo arquivo. Resolva **mantendo os dois lados**. Os outros arquivos não devem conflitar. **[Provável]**

---

## 5. Publicar

Primeiro descubra como o seu site é publicado. Na Vercel, abra **Settings > Git**:

### Caso A: o GitHub está ligado e a Production Branch é a `develop`

O merge do passo 4 **já publica sozinho**. Espere o deploy ficar com status **Ready** em **Deployments**. Se você cadastrou a variável do Google (passo 3) **depois** do último deploy, faça também um **Redeploy** para ela entrar.

### Caso B: o GitHub não está ligado (como era em 15/11)

O merge **não publica nada**. Publique pela CLI, na pasta do projeto:

```bash
git checkout develop
git pull
npm install
npm test && npm run typecheck && npm run build
npx vercel deploy --prod
```

- [ ] Esperar o comando terminar e abrir `https://treino-a-dois-theta.vercel.app`.
- [ ] A CLI publica **o que está na pasta**, não o que está no GitHub. Se a pasta estiver numa branch sem o código com GPS, o GPS **não** vai ao ar. **[Certa]**

### Depois de publicar

- [ ] No iPhone, o app instalado guarda uma cópia (service worker). Feche o app de verdade (deslizar para cima) e abra de novo; às vezes é preciso abrir duas vezes para pegar a versão nova.

---

## 6. Teste de ponta a ponta no iPhone

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
| Fiz o merge na `develop`, mas o site não mudou | O GitHub não está ligado à Vercel, então o merge não publica | Passo 5, caso B |
| Publiquei, mas o site não tem o GPS | A pasta local estava numa branch sem o código novo | Conferir que o merge entrou na `develop`, `git checkout develop`, `git pull` e publicar de novo |
| "Ative a localização para registrar o treino" | Localização negada ou desligada no iPhone | Liberar em Ajustes |
| "Cadastre a academia do grupo antes de registrar o treino" | Nenhuma academia cadastrada | **Mais > Academias**, ou desligar a regra em Grupo e regras |
| "Você está a X m da academia mais próxima" | Fora do raio de 300 m, ou o GPS errou dentro do prédio | Chegar mais perto, ir para perto de uma janela e esperar o GPS. Se for constante, avaliar aumentar o raio (`gym_radius_m()` no banco e `GYM_RADIUS_M` em `src/domain/geo.ts`) |
| A busca "Buscar no Google Maps" não aparece | `VITE_GOOGLE_MAPS_API_KEY` não entrou no build | Cadastrar a variável e publicar de novo |
| A busca aparece, mas dá erro ao pesquisar | APIs não ativadas, ou o site fora da lista de referenciadores | Passo 2 |
| O app instalado mostra a versão antiga | Cópia guardada pelo service worker | Fechar o app de verdade e abrir de novo; se persistir, remover e reinstalar o atalho |

---

## Checklist final

- [ ] Migração `20261116000001_gym_location.sql` aplicada e conferida (1.2 e 1.3)
- [ ] Decidi se a regra de localização fica ligada ou desligada para o grupo (1.4)
- [ ] Chave do Google criada, com as duas APIs ativas e restrita ao site (2), **ou** decisão de deixar para depois
- [ ] `VITE_GOOGLE_MAPS_API_KEY` cadastrada na Vercel (3), se usar a chave
- [ ] Código na `develop`, **depois** dos passos acima (4)
- [ ] Publicado e com status Ready, pelo GitHub ou pela CLI (5)
- [ ] Academia cadastrada e teste no iPhone feito: dentro libera, longe bloqueia, o feed mostra o treino (6)
