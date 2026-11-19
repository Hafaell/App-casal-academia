# Treino a Dois: plano para virar um app comercial

Plano escrito em 19/11/2026, a partir do estado descrito no [PROGRESSO.md](./PROGRESSO.md) (versão 0.1.0, PWA na Vercel, Supabase gratuito, uso só do casal). Nada aqui foi executado ainda.

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**. Preços de terceiros mudam com frequência: confira no site oficial antes de pagar. Valores em reais usam câmbio aproximado de R$ 5,50 por dólar, sem IOF.

---

## 1. Resumo em uma página

| Pergunta | Resposta curta |
| --- | --- |
| Como rodar em Android e iPhone pelas lojas? | **App nativo em React Native com Expo** (TypeScript). Reaproveita `src/domain/`, os testes e a lógica de `queries.ts`; as 13 telas são reescritas. Capacitor e Flutter foram descartados (seção 3). |
| Preciso de Mac? | Para **compilar** o app de iPhone, sim, mas é um Mac na nuvem do **EAS Build** (Expo). Dá para publicar sem ter um Mac em casa; só não há simulador de iPhone no Windows, então os testes de iOS usam um aparelho real. |
| Fico no Supabase? | **Sim.** Todas as regras que valem dinheiro (`close_week`, gatilhos, RLS) estão em Postgres. Trocar de banco seria reescrever o coração do app. Gratuito durante o desenvolvimento e o beta fechado; **Pro (US$ 25/mês)** no lançamento público, principalmente por causa de backup e de não pausar. |
| Existe caminho 100% gratuito? | Existe, mas não recomendo para produto pago: sem backup automático, projeto pausa por inatividade, limites baixos de fotos. Ver seção 5.4. |
| Quanto custa o mínimo no primeiro ano? | Cerca de **R$ 2.300 a R$ 2.600** (Apple, Google, domínio e Supabase Pro a partir do lançamento). Sem empresa aberta e sem comprar Mac. Detalhe na seção 9. O caminho mais econômico, que adia cada gasto até ele ser inevitável, está na seção 12. |
| O que mais falta? | Excluir conta dentro do app, recuperar senha, política de privacidade, termos de uso, moderação de conteúdo (denunciar e bloquear), regras de dono do grupo, convite seguro, assinatura via loja, ambiente de testes separado e monitoramento. |
| Prazo realista? | **5 a 7 meses** até as lojas, com o app nativo em React Native (8 a 12 semanas só para o app) **[Adivinhando]**. |

---

## 2. O que já está pronto e serve para o produto comercial

Não é pouco. A base é sólida:

- Regras de dinheiro no banco, com testes em Postgres (`supabase/tests/`), idempotentes e imutáveis depois do fechamento **[Certa]**.
- RLS ligado em todas as tabelas e no bucket de fotos; fotos privadas lidas por URL assinada de 1 hora **[Certa]**.
- Funções `security definer` com `search_path` fixo na grande maioria **[Certa]** (conferir todas pelo Security Advisor).
- Regras por grupo (meta, faixa de multa, domingo, coringas, GPS), o que já abre caminho para grupos de amigos **[Certa]**.
- Teste de ponta a ponta contra o Supabase real (53 passos) **[Certa]**.
- Código separado em domínio, dados e telas, o que facilita trocar APIs do navegador por plugins nativos **[Certa]**.

---

## 3. Como chegar ao Android e ao iPhone: app nativo em React Native (Expo)

**Decisão (19/11/2026):** não embrulhar o site com Capacitor. O app de loja será um **app nativo em React Native com Expo**, escrito em TypeScript. A web atual (PWA na Vercel) fica como versão de apoio até a migração terminar. O banco e as regras continuam iguais no Supabase.

### 3.1 Opções comparadas (para quem quer a melhor base desde o início)

| Caminho | Reaproveita | Qualidade nativa | Veredito |
| --- | --- | --- | --- |
| Capacitor (site embrulhado) | ~95% | Média: roda num WebView | Descartado por decisão do dono do projeto |
| **React Native + Expo** | `src/domain/` e a lógica de `src/data/` (~30% **[Adivinhando]**) | Alta: usa componentes reais do iOS e do Android | **Escolhido** |
| Flutter | Nada (outra linguagem, Dart) | Alta: desenha cada pixel por conta própria | Boa tecnologia, mas obriga a reescrever também as regras e não aproveita o seu TypeScript |
| Swift (iPhone) + Kotlin (Android) | Nada, e são dois apps | A mais alta | Dobra o trabalho e a manutenção. Só vale com equipe grande |
| Kotlin Multiplatform | Só a lógica | Alta | Ecossistema menor e parte do trabalho no iPhone pede Mac **[Provável]** |

### 3.2 Por que React Native e não Flutter

- **Já é seu idioma.** O app é React e TypeScript. As regras que valem dinheiro em `src/domain/` (datas, meta, exceções, sequência) e os 28 testes passam para o app novo sem reescrever **[Certa]**. No Flutter, tudo isso seria reescrito em Dart e as duas versões das regras ficariam sem garantia de serem idênticas.
- **A diferença de desempenho diminuiu.** As fontes de 2026 dizem que a vantagem do Flutter encolheu bastante, porque o React Native deixou a antiga "ponte" e chama o código nativo direto (arquitetura nova). Para um app de feed, câmera e formulários, o usuário não vai notar **[Provável]**. As fontes são em grande parte blogs de agências, então não trate os números como medidos.
- **Supabase tem guia oficial para Expo**, com a sessão guardada no cofre do aparelho (Keychain no iPhone, Keystore no Android).
- **Mais gente, mais bibliotecas e mais vagas** no ecossistema npm do que no Dart **[Provável]**.
- Onde o Flutter ganharia: interface muito personalizada e igual nas duas plataformas. Não é o caso de um app de feed e formulários.

### 3.3 Ferramentas recomendadas (a pilha)

| Necessidade | Ferramenta | Observação |
| --- | --- | --- |
| Base | **Expo SDK 55** (React Native 0.83), TypeScript estrito | Desde o SDK 55 a arquitetura nova é obrigatória e todos os pacotes Expo seguem a mesma versão **[Certa]**. Confira a versão atual na hora de começar |
| Telas e rotas | **Expo Router** (rotas por arquivo) | Substitui o `react-router` |
| Dados | `@supabase/supabase-js` + **React Query** (mantém `queries.ts`) | Sessão em `expo-secure-store` com criptografia, como no guia oficial do Supabase |
| Estilo | **NativeWind** (Tailwind no React Native) ou `StyleSheet` | NativeWind aproveita o vocabulário que você já usa. Teste num protótipo antes de fechar **[Provável]** |
| Listas longas (feed) | **FlashList** | Rolagem fluida com muitas fotos |
| Animações | **Reanimated** + **Gesture Handler** | Roleta, reações, transições |
| Câmera | **expo-camera** (ou `react-native-vision-camera`) | Só captura ao vivo, sem galeria: fecha o ponto fraco da foto "na hora" |
| Carimbo na foto e cartão da semana | **@shopify/react-native-skia** ou `react-native-view-shot` | Substituem os `canvas` de `image.ts` e `summaryCard.ts` |
| Localização | **expo-location** | Mesma regra de 100 m, conferida no banco |
| Mapa das academias | **react-native-maps** | Substitui o Leaflet. Círculo de 100 m e pino arrastável |
| Compartilhar, vibrar | `expo-sharing`, `expo-haptics` | |
| Notificações | **expo-notifications** + Firebase (Android) + APNs (iPhone) | Disparadas por uma Edge Function do Supabase |
| Login com Apple e Google | `expo-apple-authentication` e login do Google | A Apple exige "Entrar com Apple" quando há login social **[Provável]** |
| Assinatura | **RevenueCat** (`react-native-purchases`) | Une App Store e Google Play |
| Erros e métricas | **Sentry** e **PostHog** | |
| Testes | **Jest** e React Native Testing Library nas telas; **Maestro** para fluxos de ponta a ponta; testes de `domain/` mantidos | |
| Build e envio | **EAS Build**, **EAS Submit** e **EAS Update** | Compila o iPhone num Mac na nuvem. Plano grátis com ~15 builds de iOS por mês (conferir em expo.dev/pricing); o Starter custa ~US$ 19/mês **[Provável]** |

### 3.4 O que aproveita e o que é reescrito

| Parte do projeto | Destino |
| --- | --- |
| `src/domain/*` e seus testes | **Reaproveita** sem mudar (idealmente num pacote compartilhado, ver 3.6) |
| `supabase/migrations/` e `supabase/tests/` | **Não muda.** O banco é o mesmo |
| `src/data/queries.ts` | **Reaproveita quase tudo.** Muda o envio de foto (do navegador para arquivo do aparelho) |
| `src/lib/supabase.ts` | **Reescrito:** armazenamento seguro da sessão |
| `src/lib/image.ts`, `summaryCard.ts` (canvas) | **Reescritos** com Skia ou `view-shot` |
| `GymPicker`, `GymsMap`, `mapsLink` (Leaflet, Nominatim) | **Reescritos** com `react-native-maps`. O `api/maps-link.ts` vira Edge Function do Supabase ou é substituído pela busca de lugares |
| 13 telas em `src/pages/` e `components/` | **Reescritas**, tela por tela, com a mesma lógica |
| `react-router`, service worker do PWA, `vercel.json` | **Saem** do app nativo |

### 3.5 Trabalhando sem Mac

- **Android:** Android Studio no Windows, de graça. O emulador funciona.
- **iPhone:** não existe simulador de iPhone no Windows. **No começo dá para testar de graça com o Expo Go** (app gratuito da App Store que roda o seu projeto no iPhone, com o computador Windows servindo o código). Ele serve para câmera, localização, mapa e animações, mas **não** testa notificações remotas (push) nem pacotes nativos fora da lista dele, como o RevenueCat. Quando chegar nesse ponto, é preciso um **"development build"** no EAS, e instalar um build no iPhone exige a conta Apple Developer paga ([Expo](https://docs.expo.dev/develop/development-builds/introduction/)). Ver a seção 12.
- Distribuição de testes: **TestFlight** (iPhone) e teste fechado na Google Play (Android).
- Um Mac usado só é necessário se for depurar problemas muito específicos do Xcode.

### 3.6 Como organizar o código

Recomendo um **monorepo** (npm workspaces) com três partes:

```
packages/domain/   regras puras e testes (compartilhado)
apps/mobile/       app Expo (iPhone e Android)
apps/web/          PWA atual (fica até a migração acabar; depois vira só página de apresentação)
```

Assim as regras de multa continuam num lugar só, e `close_week` no banco e `rules.ts` no app seguem idênticos, como manda o CLAUDE.md.

### 3.7 Prazo e custo de trabalho

- **8 a 12 semanas** para chegar ao beta com paridade de funções, trabalhando sozinho **[Adivinhando]**. É mais que as 3 a 4 semanas do Capacitor, e é o preço de ter um app nativo desde o início.
- Ordem sugerida: (1) projeto Expo, login e sessão segura; (2) Início, Feed e check-in com câmera e GPS; (3) Histórico, Caixinha, Roleta, Exceções e Sequência; (4) academias e mapa; (5) notificações; (6) cartão da semana e reações; (7) polimento, acessibilidade e testes.

### 3.8 Riscos do React Native

- **Atualizações de versão trazem trabalho.** O Expo lança uma versão grande a cada poucos meses. Planeje atualizar a cada 2 ou 3 versões **[Provável]**.
- **Bibliotecas de terceiros** (mapa, câmera avançada) podem atrasar para acompanhar a arquitetura nova. Prefira pacotes oficiais do Expo quando existirem.
- **Sem simulador de iPhone no Windows**, os testes de iOS dependem de um aparelho real e de builds na nuvem.
- Ser nativo não dispensa medir. Teste em um Android barato e em um iPhone antigo, e use o Sentry desde a primeira versão.

---

## 4. Segurança: o que falta antes de abrir para desconhecidos

Hoje o modelo de confiança é "um casal que se conhece". Com estranhos, vários pontos viram problema.

### 4.1 Obrigatório (bloqueia o lançamento)

| # | Item | Por quê |
| --- | --- | --- |
| S1 | **Excluir a conta dentro do app** (apaga perfil, fotos, check-ins; anonimiza o histórico financeiro do grupo) | Exigido pela Apple (5.1.1(v)) e pela Google Play, que também pede um link web para pedir exclusão **[Certa]** |
| S2 | **Recuperar senha** por e-mail | Não existe hoje. Sem isso, quem esquece a senha perde a conta |
| S3 | **Confirmação de e-mail ligada** + SMTP próprio (Resend, Brevo ou Amazon SES) | O SMTP embutido do Supabase tem limite muito baixo e não serve para produção **[Provável]**. Hoje "Confirm email" está desligado |
| S4 | **Convite seguro.** O código atual tem 6 caracteres hexadecimais (16,7 milhões de combinações) e nunca expira **[Certa]** | Dá para tentar códigos em massa pela função `join_group`. Usar código mais longo, expiração, limite de tentativas por usuário e opção de "aprovar entrada" |
| S5 | **Papéis no grupo.** Só o dono edita regras, roleta e remove membros | Hoje qualquer membro edita tudo **[Certa]**. O campo `role` já existe |
| S6 | **Moderação de conteúdo** (fotos, punições e motivos são texto e imagem de usuários) | A Apple (regra 1.2) exige: filtro, botão de denunciar conteúdo **para o desenvolvedor**, bloquear usuário, termos com tolerância zero e resposta em até 24 h **[Certa]**. O "Reportar" atual só cancela o treino dentro do grupo |
| S7 | **CAPTCHA** no cadastro e no login (Cloudflare Turnstile ou hCaptcha, suportados pelo Supabase) e revisar os limites de taxa do Auth | Evita criação de contas em massa e tentativa de senha |
| S8 | **Rodar o Security Advisor e o Performance Advisor** do painel do Supabase e zerar os alertas | Pega função sem `search_path`, tabela sem RLS, índice faltando **[Certa]** que existem; o resultado eu não sei |
| S9 | **Ambiente de testes separado** (projeto Supabase "staging") | Hoje o `test:e2e` roda contra produção e deixa contas e grupos lá. Com clientes reais, isso não pode |

### 4.2 Importante (primeiros meses)

- **Senhas:** mínimo de 8 caracteres e proteção contra senhas vazadas (recurso do Auth no plano Pro **[Provável]**).
- **Login com Apple e Google** (opcional, melhora a conversão). Atenção: se oferecer login com Google, a Apple exige uma opção equivalente de privacidade, na prática o "Entrar com Apple" **[Provável]**.
- **Fotos:** apagar originais depois de X meses (ex.: 90 dias) e manter só miniatura. Reduz custo e risco de vazamento. Conferir que a foto sai sem metadados EXIF (o carimbo pelo `canvas` já reencoda a imagem, o que normalmente remove EXIF **[Provável]**).
- **Localização:** guardar só o necessário (distância calculada e academia escolhida), não a coordenada exata de cada check-in, se não for preciso.
- **Caixinha:** quem recebe confirma o pagamento (hoje qualquer membro marca como pago **[Certa]**).
- **`api/maps-link`:** já tem lista fechada de domínios; falta limite de requisições por IP. Pode virar Edge Function do Supabase e sair da Vercel.
- **Monitoramento:** Sentry (erros no app), alerta se o job `fechar-semanas` falhar, alerta de uso perto do limite.
- **Integração contínua:** GitHub Actions rodando `typecheck`, `test`, `build` e `test:db` a cada push; Dependabot para dependências.
- **Backups:** além do diário do Pro, um `pg_dump` semanal guardado fora do Supabase (por exemplo, num bucket do Cloudflare R2).
- **Revisão de segurança externa** antes de cobrar (um pentest pequeno ou ao menos o `/security-review` sobre o projeto inteiro).

---

## 5. Banco de dados: ficar no Supabase, pagar ou trocar?

### 5.1 O que o app usa do Supabase

Postgres com RLS e funções, Auth (e-mail e senha), Storage (fotos), `pg_cron` (fechar a semana) e, no futuro, Edge Functions (push). É praticamente todo o back-end.

### 5.2 Planos do Supabase **[Provável]** (conferir em supabase.com/pricing)

| | Free | Pro |
| --- | --- | --- |
| Preço | US$ 0 | US$ 25/mês por organização, com US$ 10 de crédito de computação (cobre 1 projeto Micro) |
| Banco | 500 MB | 8 GB incluídos |
| Fotos (Storage) | 1 GB | 100 GB incluídos |
| Tráfego de saída | 5 GB | 250 GB incluídos |
| Usuários ativos/mês | 50.000 | 100.000 |
| Pausa por inatividade | Sim, após ~7 dias | Não |
| Backup | Não | Diário, 7 dias |
| Transformação de imagem (miniaturas) | Não | Sim |

**Atenção à organização "Hafael":** o Pro é cobrado por organização e cada projeto extra ativo consome computação **[Provável]**. O projeto "Financeiro" está na mesma organização. Antes de assinar o Pro, **mova o "Financeiro" para outra organização** (ou o Treino a Dois para uma organização nova), senão ele entra na conta.

### 5.3 Conta de padaria das fotos

- Cada foto tem 100 a 300 KB. Com 4 treinos por semana, uma pessoa gera cerca de **40 a 60 MB por ano** **[Provável]**.
- No Free (1 GB): dá para ~20 pessoas por um ano.
- No Pro (100 GB): ~2.000 pessoas por um ano sem apagar nada; com a regra de apagar originais após 90 dias, bem mais.
- O tráfego de saída (fotos vistas no feed) tende a ser o custo que cresce primeiro. Miniaturas e cache resolvem a maior parte.
- Se as fotos ficarem caras: mover só o Storage para o **Cloudflare R2** (10 GB grátis e sem cobrança de tráfego de saída **[Provável]**), mantendo o resto no Supabase.

### 5.4 Alternativas, inclusive gratuitas

| Opção | Custo | Esforço de migração | Veredito |
| --- | --- | --- | --- |
| **Supabase Free no beta, Pro no lançamento** | US$ 0, depois US$ 25/mês | Zero | **Recomendado** |
| Supabase Free para sempre + backup caseiro (`pg_dump` diário pelo GitHub Actions) | US$ 0 | Baixo | Aceitável no **beta fechado**. Risco de pausa e limites de fotos; não use com cliente pagante |
| Supabase auto-hospedado (VPS Hetzner ~€5/mês ou Oracle Cloud grátis) | ~R$ 0 a 35/mês | Médio | Você vira o administrador: atualizações, backup, disponibilidade, segurança. Não vale para uma pessoa só |
| Firebase (Firestore + Cloud Functions) | Grátis no início, depois por uso | **Altíssimo**: reescrever regras, RLS e fechamento | Não |
| Neon (Postgres grátis) + Clerk/Better Auth + R2 | Grátis no início | Alto: o RLS depende de `auth.uid()` do Supabase | Não |
| Appwrite Cloud / PocketBase | Grátis no início | Alto | Não |

**Conclusão:** continue no Supabase. O que você paga (US$ 25/mês) compra backup, ausência de pausa e folga de limites. Qualquer alternativa "gratuita" troca dinheiro por semanas de reescrita e por risco nas regras de multa.

---

## 6. Lojas: o que precisa ter para publicar

### 6.1 Contas

| | Apple App Store | Google Play |
| --- | --- | --- |
| Conta | Apple Developer Program | Google Play Console |
| Preço | **US$ 99/ano** (cobrado em reais) **[Certa]** | **US$ 25, uma vez** **[Certa]** |
| Como pessoa física | Pode. O nome do vendedor na loja será o **seu nome completo** **[Certa]** | Pode. Exige verificação de identidade e mostra seu nome e país **[Provável]** |
| Como empresa | Exige CNPJ e número D-U-N-S (grátis, demora alguns dias) **[Certa]** | Exige D-U-N-S também **[Provável]** |
| Exigência extra | Revisão humana de cada versão (1 a 3 dias, às vezes mais) **[Provável]** | Conta pessoal nova precisa de **teste fechado com pelo menos 12 testadores por 14 dias seguidos** antes de liberar a produção **[Provável]** |

O teste fechado da Google é um bom motivo para começar o beta cedo: junte 12 amigos com Android.

### 6.2 Material de cada loja

- Nome do app, subtítulo, descrição, palavras-chave, categoria (Saúde e fitness).
- Ícone 1024x1024 (Apple) e 512x512 (Google), capturas de tela de iPhone (6,7" e 6,5") e de Android, gráfico de destaque 1024x500 (Google).
- **URL da política de privacidade** (obrigatória nas duas) e URL de suporte.
- **Rótulos de privacidade** (Apple) e **Segurança dos dados** (Google): declarar e-mail, fotos, localização aproximada e precisa, identificadores e se há rastreamento.
- Classificação etária: questionário da Apple e IARC na Google. Sugestão: **18+** por envolver dinheiro entre pessoas.
- **Conta de demonstração para o revisor da Apple**, com um grupo pronto e dados. Importante: o revisor não estará na sua academia, então o grupo de demonstração precisa ter a regra de GPS desligada **[Certa]** (ou ele recusa o app por "não consegui testar").
- Google: nível de API alvo exigido no ano (em 2026, provavelmente Android 15 ou 16) **[Provável]**, link web de exclusão de conta e declaração de uso de localização só em primeiro plano.

### 6.3 Pontos de revisão que podem dar problema

- **Roleta e sorteio de multa:** não é aposta (ninguém aposta para ganhar prêmio), mas evite visual de cassino e deixe claro que o app não movimenta dinheiro **[Provável]**.
- **Dinheiro entre pessoas:** o app só registra quem deve. Não intermedie pagamentos: intermediar exigiria regras do Banco Central **[Provável]**. Gerar um "Pix copia e cola" com a chave de quem recebe é seguro, porque o dinheiro não passa por você.
- **Punições:** proibir nos termos punições perigosas, humilhantes ou sexuais, com filtro de palavras e denúncia.
- **Exceção "menstruação":** é dado de saúde (ver seção 7).

---

## 7. Jurídico e LGPD

| Item | O que fazer |
| --- | --- |
| **Política de privacidade** | Quais dados (e-mail, nome, fotos, localização, check-ins, exceções), para quê, por quanto tempo, com quem compartilha (Supabase, Vercel/Cloudflare, Firebase, Sentry), como pedir exclusão. Publicada em página web |
| **Termos de uso** | Idade mínima, regras de conteúdo, tolerância zero com abuso, que o app não processa pagamentos, que multas são acordos entre usuários, limitação de responsabilidade |
| **Dado sensível** | A LGPD trata dado de saúde como sensível (art. 11) **[Certa]**. "Menstruação", "doença" e "lesão" entram aí. Opções: trocar por um genérico "Saúde" ou pedir consentimento explícito e destacado. Recomendo o genérico |
| **Direitos do titular** | Exportar os próprios dados e excluir a conta (casa com o S1) |
| **Canal do encarregado (DPO)** | Agente de pequeno porte pode ser dispensado de nomear encarregado, mas precisa de um canal de contato **[Provável]**. Um e-mail tipo privacidade@seudominio resolve |
| **Transferência internacional** | Banco em São Paulo é bom. Serviços nos EUA (Vercel, Sentry, Firebase) precisam constar na política |
| **Marca** | Pesquisar "Treino a Dois" no INPI e nas lojas antes de investir em marketing. Registrar a marca no INPI (taxa reduzida para pessoa física e ME **[Provável]**) |
| **Empresa (CNPJ)** | Não é obrigatório para começar. Ao faturar, converse com um contador: desenvolvimento de software normalmente não cabe no MEI **[Adivinhando]**; receita das lojas vem do exterior (Apple e Google pagam em dólar) e tem tratamento tributário próprio |

Vale uma revisão de um advogado na política e nos termos antes do lançamento público. Existem geradores, mas o tema dinheiro entre usuários pede olhar humano.

---

## 8. Modelo de negócio

### 8.1 Público

Hoje: um casal. Comercial: casais e grupos de amigos que querem se cobrar na academia. O "dinheiro na mesa" é o diferencial; o convite é o motor de crescimento (cada grupo traz pelo menos uma pessoa nova).

### 8.2 Como cobrar

| Modelo | Prós | Contras |
| --- | --- | --- |
| **Freemium com assinatura** (recomendado) | Receita recorrente, combina com hábito semanal | Precisa de motivo claro para assinar |
| Compra única | Simples | Receita não acompanha custo de fotos |
| Anúncios | Grátis para o usuário | Pouca receita com poucos usuários; atrapalha a experiência |

Sugestão de divisão **[Adivinhando]**:

- **Grátis:** grupo de até 2 pessoas, todas as regras atuais, histórico de 3 meses.
- **Premium (por grupo, pago por um membro):** grupos de até 10, ranking, histórico ilimitado, roleta e faixas de multa personalizadas, estatísticas, temas. Preço de referência: R$ 9,90/mês ou R$ 59,90/ano. Testar.

### 8.3 Regras de pagamento das lojas

- Conteúdo e recursos digitais **precisam** ser vendidos pela compra dentro do app (Apple IAP e Google Play Billing) **[Certa]**.
- Taxa de **15%** no Small Business Program da Apple e na Google para quem fatura até US$ 1 milhão/ano **[Certa]**.
- Use **RevenueCat** para unificar as assinaturas das duas lojas e validar no servidor (grátis até um faturamento mensal pequeno, depois percentual baixo **[Provável]**). O status Premium fica numa tabela do Supabase, atualizada por webhook.
- O dinheiro das multas (Pix entre amigos) não passa pelo app e não entra nessa regra **[Provável]**.

### 8.4 Métricas para acompanhar

Grupos ativos por semana, retenção em 7, 30 e 90 dias, porcentagem de semanas batidas, conversão para Premium, motivos de cancelamento. Ferramenta: PostHog (cota grátis generosa **[Provável]**), sem rastreamento entre apps (evita o aviso de "rastreamento" da Apple).

### 8.5 Divulgação

- Página de apresentação no domínio próprio (com os links das lojas, política e suporte).
- Instagram e Reels mostrando a roleta e o cartão da semana (o cartão compartilhável já existe e é marketing grátis).
- Indicação: quem convida ganha um mês de Premium.

---

## 9. Custos

### 9.1 Primeiro ano, caminho mínimo recomendado

| Item | Custo | Quando |
| --- | --- | --- |
| Apple Developer Program | US$ 99/ano ≈ **R$ 545** | Antes do TestFlight |
| Google Play Console | US$ 25 uma vez ≈ **R$ 140** | Antes do teste fechado |
| Domínio .com.br (registro.br) | ≈ **R$ 40/ano** **[Provável]** | Antes dos links de convite e da política |
| Supabase Pro | US$ 25/mês ≈ **R$ 140/mês** | No lançamento público (≈ R$ 1.100 a 1.650 no ano, conforme o mês do lançamento) |
| Hospedagem web | **R$ 0** (Cloudflare Pages) | Ver nota abaixo |
| E-mail transacional (Resend/Brevo) | **R$ 0** na cota grátis | Antes de ligar a confirmação de e-mail |
| Compilação e envio (EAS Build e Submit) | **R$ 0** na cota grátis (~15 builds de iOS por mês); **~US$ 19/mês** no Starter se faltar cota **[Provável]** | Desde o primeiro build |
| Push (Firebase Cloud Messaging + APNs) | **R$ 0** | |
| Sentry, PostHog, RevenueCat | **R$ 0** no início | |
| **Total aproximado** | **R$ 1.800 a 2.400 no primeiro ano** | Cartão internacional cobra IOF por cima |

**Nota sobre a Vercel:** o plano Hobby (grátis) é só para uso **não comercial** **[Certa]**. Para produto comercial, ou paga o Pro (US$ 20/mês por pessoa) ou move a versão web para Cloudflare Pages ou Netlify, que permitem uso comercial no plano grátis **[Provável]**. Como o app de loja leva os arquivos dentro dele, a hospedagem web vira só página de apresentação e versão PWA. Recomendo mover para o Cloudflare Pages e levar `api/maps-link` para uma Edge Function do Supabase.

### 9.2 Opcionais

| Item | Custo |
| --- | --- |
| Contador (com CNPJ) | R$ 150 a 400/mês **[Adivinhando]** |
| Abertura de empresa | Varia por estado; contador costuma incluir |
| Registro de marca no INPI | Algumas centenas de reais por classe **[Adivinhando]** |
| Advogado para termos e política | R$ 500 a 2.000, uma vez **[Adivinhando]** |
| Mac mini usado | R$ 2.500 a 3.500 **[Adivinhando]** |
| Atualizações de JavaScript sem passar pela loja (EAS Update) | Incluído nas cotas do Expo; conferir limites em expo.dev/pricing |
| Busca de academias pelo Google Places | Grátis dentro da cota mensal; depois por uso |

### 9.3 Quando o custo cresce

Até alguns milhares de usuários, o Pro de US$ 25 com o crédito de computação deve bastar **[Provável]**. O que cresce primeiro é Storage e tráfego das fotos (seção 5.3). Com 15% de taxa da loja e R$ 9,90/mês, umas **20 assinaturas** pagam o Supabase Pro **[Provável]**.

---

## 10. Plano de execução por fases

### Fase 0: decisões (1 semana)

- [ ] Nome definitivo do app e pesquisa de marca (INPI e lojas).
- [ ] Publicar como pessoa física ou empresa.
- [ ] Modelo de cobrança (seção 8.2).
- [ ] Comprar o domínio.
- [ ] Mover o projeto "Financeiro" para outra organização do Supabase.

### Fase 1: base segura (3 a 5 semanas)

- [ ] Projeto Supabase de staging; `test:e2e` passa a rodar só nele.
- [ ] Integração contínua no GitHub Actions.
- [ ] Recuperar senha, confirmação de e-mail e SMTP próprio.
- [ ] Excluir conta (no app e por página web) e exportar dados.
- [ ] Papéis de dono, remoção de membros, convite novo (longo, com validade e limite de tentativas).
- [ ] Denunciar conteúdo para o desenvolvedor, bloquear usuário, filtro de palavras nas punições, painel simples de moderação.
- [ ] CAPTCHA no cadastro; zerar alertas do Security Advisor.
- [ ] Exceção de saúde genérica (no lugar de "menstruação").
- [ ] Política de privacidade e termos publicados.

### Fase 2: app nativo em React Native (8 a 12 semanas)

- [ ] Conta Google criada quando o beta Android estiver perto; conta Apple só quando precisar de push, TestFlight ou lançamento (ver seção 12).
- [ ] Monorepo: `packages/domain` compartilhado, `apps/mobile` (Expo) e `apps/web` (PWA atual).
- [ ] Protótipo de uma semana para validar NativeWind, mapa e câmera antes de reescrever tudo.
- [ ] Projeto Expo com Expo Router, login e sessão em `expo-secure-store` (padrão do guia oficial do Supabase).
- [ ] Início, Feed e check-in (câmera ao vivo, GPS, carimbo da foto com Skia ou `view-shot`).
- [ ] Histórico, Caixinha, Roleta, Exceções e Sequência.
- [ ] Academias com `react-native-maps`; `api/maps-link` vira Edge Function do Supabase.
- [ ] Notificações (lembrete de treino e fechamento da semana) com Firebase e APNs.
- [ ] Cartão da semana e reações; compartilhar e vibrar.
- [ ] Universal Links e App Links para convites (exige o domínio próprio).
- [ ] EAS Build e EAS Submit configurados; development build no iPhone e no Android.
- [ ] Sentry, PostHog e testes (Jest, Maestro).

### Fase 3: beta fechado (4 a 6 semanas)

- [ ] TestFlight com o casal e amigos de iPhone.
- [ ] Teste fechado na Google Play com **12 ou mais testadores por 14 dias**.
- [ ] Grupos de 3 a 10 pessoas usados de verdade; ajustar placar, caixinha e feed para mais de 2.
- [ ] Ranking do grupo.
- [ ] Ainda no Supabase Free, com backup caseiro.

### Fase 4: lançamento (2 a 3 semanas)

- [ ] Supabase Pro; backup externo semanal.
- [ ] Assinatura com RevenueCat e IAP das duas lojas; tabela de Premium no banco.
- [ ] Fichas das lojas, capturas, rótulos de privacidade, conta de demonstração sem GPS.
- [ ] Envio para revisão (Apple) e produção (Google).
- [ ] Página de apresentação e suporte.
- [ ] Web movida para Cloudflare Pages (ou Vercel Pro).

### Fase 5: depois do lançamento

- [ ] Acompanhar retenção e conversão; ajustar preço.
- [ ] Apagar fotos antigas automaticamente; miniaturas.
- [ ] Live updates para correções rápidas.
- [ ] Revisão de acessibilidade.
- [ ] Avaliar pentest e CNPJ conforme o faturamento.

---

## 11. Decisões que são suas

| Decisão | Minha recomendação |
| --- | --- |
| Pessoa física ou empresa na Apple | Começar como pessoa física; abrir empresa quando houver receita (o nome do vendedor muda depois, com algum trabalho **[Provável]**) |
| Framework do app de loja | **React Native + Expo** (decidido em 19/11/2026, ver seção 3) |
| Nome do app | Definir antes da Fase 2 (muda ícone, `appId` e fichas; o `appId` não muda depois de publicado **[Certa]**) |
| Grátis vs pago no lançamento | Freemium, com o grupo do casal sempre grátis |
| Supabase Pro desde já ou só no lançamento | Só no lançamento; até lá Free com backup caseiro |
| Manter a Vercel | Mover para Cloudflare Pages, por causa da regra de uso não comercial do Hobby |
| Idade mínima | 18 anos |
| Exceção "menstruação" | Trocar por "Saúde" |

---

## 12. Plano econômico: o que dá para fazer de graça agora

Regra geral: **só pagar quando algo travar de verdade.** Cada gasto abaixo tem o momento certo para acontecer. Pesquisa feita em 19/11/2026; confira os preços nos sites oficiais antes de pagar.

### 12.1 Resumo

- **Desenvolver e testar no seu celular: R$ 0.** Dá para fazer isso com o Expo Go, sem conta Apple e sem conta Google.
- **Banco, login e fotos: R$ 0.** O Supabase gratuito que já está no ar basta até o beta.
- **Primeiros gastos reais:** Google Play (US$ 25, uma vez ≈ R$ 140) quando for começar o beta Android, e Apple (US$ 99 por ano ≈ R$ 545) quando precisar de notificações no iPhone, TestFlight ou lançamento.
- **Supabase Pro (US$ 25 por mês)** só no lançamento público.

### 12.2 Tabela: o que usar agora e quando pagar

| Necessidade | Opção gratuita agora | Limite da opção gratuita | Quando pagar | Custo depois |
| --- | --- | --- | --- | --- |
| **Escrever o código** | VS Code e Node.js, grátis | Nenhum | Nunca | R$ 0 |
| **Testar no Android** | Expo Go no celular, ou emulador do Android Studio no Windows | Nenhum relevante | Nunca | R$ 0 |
| **Testar no iPhone** | **Expo Go** (grátis na App Store), com o Windows servindo o código | Não testa notificações remotas (push) nem pacotes nativos fora da lista do Expo Go, como o RevenueCat. Câmera, localização, mapa e animações funcionam **[Provável]** | Quando precisar testar push, assinatura ou instalar um build próprio | Apple US$ 99/ano |
| **Compilar o app Android (.aab para a loja)** | Android Studio no Windows (local) ou cota grátis do EAS Build | O EAS grátis tem fila lenta e cerca de 15 builds de iOS por mês (conferir em expo.dev/pricing) | Só se faltar cota | EAS Starter ~US$ 19/mês |
| **Compilar o app iPhone** | Não existe caminho gratuito a partir do Windows. Build em aparelho exige a conta Apple paga; o único caminho grátis exige um Mac ([Expo](https://docs.expo.dev/develop/development-builds/introduction/)) | Só dá para testar no iPhone pelo Expo Go | No fim da fase de desenvolvimento, antes do TestFlight | Apple US$ 99/ano |
| **Banco, login e fotos** | **Supabase Free** (o que já está no ar) | 500 MB de banco, 1 GB de fotos, 5 GB de tráfego, 50 mil usuários ativos, 2 projetos grátis. **Pausa após cerca de 1 semana sem atividade no banco** e só volta quando alguém reativa no painel ([Supabase](https://supabase.com/kb/faqs/platform/free-project-pausing)) | No lançamento público (backup e sem pausa) | Supabase Pro US$ 25/mês |
| **Impedir a pausa durante o desenvolvimento** | Uma tarefa agendada no GitHub Actions que consulta o banco uma vez por dia | Não verifiquei na documentação do Supabase **[Provável]** | Some quando virar Pro | R$ 0 |
| **Banco de testes separado (staging)** | **Não criar agora.** O teste de ponta a ponta já usa grupos de teste dentro do banco atual | O plano grátis permite 2 projetos, e o "Financeiro" já ocupa um **[Provável]** | Antes de ter usuários reais | R$ 0 a US$ 10/mês |
| **Servidor para a API** | Nenhum. O Supabase já é a API | | | |
| **Funções do servidor (push, link do Maps)** | Edge Functions do Supabase | Cota gratuita mensal **[Provável]** | Raramente | Incluído no Pro |
| **Site de apoio e política de privacidade** | Vercel Hobby enquanto for só teste, ou Cloudflare Pages (grátis, permite uso comercial **[Provável]**) | A Vercel Hobby é proibida para uso comercial | No lançamento | R$ 0 no Cloudflare |
| **Notificações push** | Firebase Cloud Messaging e Expo Push Service, gratuitos | No iPhone exige a conta Apple paga | | R$ 0 |
| **E-mail (confirmar cadastro, recuperar senha)** | Enquanto "Confirm email" estiver desligado, nada. Depois, Resend ou Brevo no plano grátis | Cota mensal pequena | Só ao abrir para desconhecidos | R$ 0 no início |
| **Erros e métricas** | Sentry e PostHog, planos gratuitos | Cotas mensais | Só no beta | R$ 0 no início |
| **Assinaturas** | RevenueCat grátis até um faturamento mensal pequeno **[Provável]** | | Só no lançamento | Percentual baixo sobre a receita |
| **Testes automáticos e build** | GitHub Actions, com minutos grátis por mês em repositório privado **[Provável]** | Cota mensal | Dificilmente | R$ 0 |
| **Domínio próprio** | Endereço grátis de Cloudflare Pages (`algo.pages.dev`) serve para a política de privacidade durante os testes | Links de convite que abrem o app (Universal Links) exigem domínio próprio | Antes do beta com convites | ≈ R$ 40/ano |
| **Política de privacidade e termos** | Gerador gratuito, hospedado grátis | Revisão de advogado só antes do lançamento | Antes do lançamento | R$ 500 a 2.000, uma vez **[Adivinhando]** |
| **Conta Google Play** | Nenhuma opção grátis | Conta pessoal nova exige teste fechado com 12 testadores por 14 dias seguidos ([fonte](https://www.testerscommunity.com/blog/google-play-closed-testing-requirements-2026)) | Quando o app Android estiver pronto para o beta | US$ 25, uma vez (não confirmei o valor nesta pesquisa) |
| **Conta Apple Developer** | Nenhuma opção grátis para publicar | | Quando precisar de push, TestFlight ou lançamento | US$ 99 por ano |

### 12.3 Ordem de gastos sugerida

1. **Agora até o app funcionar no Expo Go: R$ 0.** Desenvolve, testa no seu celular, usa o Supabase grátis.
2. **Quando o app estiver quase completo e faltar testar push e assinatura:** conta Apple (≈ R$ 545 por ano). Só então vale fazer o primeiro build de teste para o iPhone.
3. **Quando for começar o beta Android:** conta Google (≈ R$ 140, uma vez). Comece o teste fechado cedo: são 14 dias seguidos com 12 testadores.
4. **Antes de convidar desconhecidos:** domínio (≈ R$ 40 por ano), e-mail transacional grátis, CAPTCHA, política de privacidade e termos.
5. **No lançamento público:** Supabase Pro (≈ R$ 140 por mês), RevenueCat e as assinaturas.

**Dinheiro até o primeiro lançamento (sem contar o Supabase Pro): cerca de R$ 725** (Apple, Google e domínio). Isso adia o gasto mensal para o dia em que o app já puder gerar receita.

### 12.4 Cuidados para não gastar à toa

- **Não pague a Apple antes de testar no Expo Go.** Se o app não funcionar bem no Expo Go, ainda não é hora de gastar.
- **Não assine o Expo Starter nem o Supabase Pro "por garantia".** Nenhum dos dois é necessário para desenvolver.
- **Mantenha o projeto Supabase ativo** durante o desenvolvimento (use o app ou agende a consulta diária), senão ele pausa e o fechamento da semana não roda.
- **Cartão internacional:** Apple e Google cobram em dólar e o banco soma IOF. Guarde uns 10% de folga.
- **Se o Expo Go bloquear algo** que o app precisa (push, RevenueCat), isso é sinal de que chegou a hora do passo 2, e não de pagar antes.
