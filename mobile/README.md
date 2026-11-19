# Treino a Dois: app nativo (React Native com Expo)

Este é o mesmo app do site, reescrito para rodar como **aplicativo de verdade** no iPhone e no Android. As telas, as regras e o banco (Supabase) são os mesmos. Nada do site mudou.

Legenda de confiança: **[Certa]**, **[Provável]**, **[Adivinhando]**.

## O que é cada coisa

- **React Native:** jeito de fazer aplicativo de celular com o mesmo React e TypeScript do site. Os botões, a câmera e o mapa são os nativos do iPhone e do Android.
- **Expo:** conjunto de ferramentas que cuida da parte chata (câmera, GPS, mapa, empacotar o app). É o que o projeto usa por cima do React Native.
- **Expo Go:** aplicativo **gratuito** da App Store e da Google Play que abre o seu projeto no celular enquanto o computador serve o código. Serve para testar sem pagar conta de desenvolvedor.
- **Metro:** o "empacotador" que junta o código e manda para o Expo Go. Ele roda quando você digita `npx expo start`.

## Onde está cada parte

```
mobile/
  src/app/         Rotas (cada arquivo é uma tela; Expo Router)
  src/screens/     As telas, uma por arquivo (iguais às de src/pages do site)
  src/components/  Botões, cartões, janelas, abas, mapas
  src/data/        Acesso ao Supabase (mesmo queries.ts do site, com o envio de foto adaptado)
  src/providers/   Login e grupo atual
  src/lib/         Supabase, GPS, foto com carimbo (Skia), cartão da semana, links do Google Maps
  src/test/        Testes das telas com um Supabase simulado
../src/domain/     Regras (datas, meta, sequência, GPS). O app usa as MESMAS do site, sem copiar
```

As regras de meta, datas e sequência ficam num lugar só (`src/domain/` na raiz). Mudou uma regra: o site e o app mudam juntos.

## Abrir o app no seu iPhone (passo a passo)

Custo: **zero**. Não precisa de conta da Apple paga nem de Mac.

### Passo 1. Instalar o Expo Go no iPhone

1. No iPhone, abra a **App Store**, procure **Expo Go** e instale.
2. Resultado esperado: o ícone do Expo Go aparece na tela inicial.

### Passo 2. Baixar a branch do app no computador

No Windows, abra o **Terminal** (tecla Windows, digite "Terminal", Enter) e vá para a pasta do projeto. Depois:

```bash
git fetch origin
git checkout react-native
```

Resultado esperado: `Switched to branch 'react-native'`. Se aparecer erro dizendo que há alterações não salvas, me chame antes de continuar.

### Passo 3. Instalar as dependências do app

```bash
cd mobile
npm install
```

Resultado esperado: termina com algo como `added ... packages`. Pode levar alguns minutos na primeira vez. Avisos amarelos (`npm warn`) são normais.

### Passo 4. Dizer ao app onde está o banco

1. Na pasta `mobile`, copie o arquivo `.env.example` e dê o nome de `.env.local`:
   ```bash
   copy .env.example .env.local
   ```
2. Abra o `.env.local` no Bloco de Notas e preencha com **os mesmos valores** do `.env.local` do site (na pasta de cima), só que com o nome começando por `EXPO_PUBLIC_`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://hyxvesqvvhueaigclpbl.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=(a mesma chave anon do site)
   ```
3. Salve. A chave anon é pública por desenho; a `service_role` **nunca** entra aqui.

### Passo 5. Ligar o app

```bash
npx expo start
```

Resultado esperado: aparece um **QR code** no terminal e a mensagem `Metro waiting on exp://...`.

### Passo 6. Abrir no iPhone

1. O iPhone e o computador precisam estar **no mesmo Wi-Fi**.
2. Abra a **Câmera** do iPhone e aponte para o QR code. Toque no aviso "Abrir no Expo Go".
3. Resultado esperado: o Expo Go baixa o app (barra de progresso na primeira vez) e abre a tela **Treino a Dois** com "Entrar" e "Criar conta".
4. Entre com a mesma conta do site. Os dados são os mesmos.
5. No primeiro check-in, o iPhone pergunta sobre **câmera** e **localização**: toque em **Permitir** (localização: "Durante o Uso").

### Se der errado

| O que aparece | O que fazer |
| --- | --- |
| No iPhone: "Could not connect to the server" ou fica carregando para sempre | O Wi-Fi bloqueia a conexão. Pare o terminal (Ctrl+C) e rode `npx expo start --tunnel`. Na primeira vez ele pergunta se pode instalar o `@expo/ngrok`: responda `y`. Escaneie o QR code novo |
| O Windows pergunta sobre o Firewall para o Node.js | Marque **Redes privadas** e clique em **Permitir acesso** |
| No iPhone: "Project is incompatible with this version of Expo Go" | Atualize o Expo Go na App Store. O projeto usa o **Expo SDK 58** |
| Tela "Falta configurar o Supabase" | O `.env.local` não foi lido. Confira o nome do arquivo (`.env.local`, sem `.txt` no fim), salve e rode `npx expo start --clear` |
| A câmera ou o GPS foram negados sem querer | iPhone: Ajustes > Expo Go > Câmera / Localização |

## Comandos (na pasta `mobile`)

```bash
npx expo start      # liga o app para abrir no Expo Go
npm test            # testes das telas (Supabase simulado) e do desenho da foto
npm run typecheck   # confere os tipos do TypeScript
npm run doctor      # confere versões e configuração do Expo
npm run export      # empacota iOS e Android (prova que o app compila para o celular)
```

Na raiz, `npm test` continua rodando os testes das regras usadas pelo site e pelo app.

## Diferenças em relação ao site (de propósito, por ser app de celular)

- **Câmera:** usa a câmera nativa (`expo-camera`). Não existe opção de escolher da galeria, então o "plano B" do site (câmera do iPhone por arquivo) não é necessário.
- **Mapa:** o mapa do próprio celular (Apple Maps no iPhone, Google Maps no Android) no lugar do OpenStreetMap. O botão "Satélite" continua lá. A busca por nome dentro do mapa continua sendo a do OpenStreetMap.
- **Links curtos do Google Maps** (`maps.app.goo.gl`) continuam sendo abertos pela função `/api/maps-link` do site publicado (`EXPO_PUBLIC_SITE_URL`).
- **Sessão de login** guardada no cofre do aparelho (Keychain/Keystore), como no guia oficial do Supabase para Expo.
- **Puxar a tela para baixo** recarrega o Início e o Feed (no site, era recarregar a página).
- **Convite:** o botão Compartilhar manda o link do site e o código. Quem usa o app digita o código.

## O que ainda não foi testado num aparelho de verdade

Tudo abaixo foi testado no computador (tipos, telas com Supabase simulado, desenho da foto com o Skia de computador e empacotamento para iOS e Android), mas **não num iPhone real**:

- Câmera e GPS dentro do Expo Go **[Provável]** que funcionem: os dois fazem parte do Expo Go.
- O carimbo na foto com o Skia nativo e as fontes do iPhone **[Provável]**.
- Datas no fuso do grupo no motor do celular (Hermes) **[Provável]**: a função de data foi ajustada para não depender do formato do navegador.

## Mais tarde (não feito agora, ver `app-comerciavel.md`)

Publicar nas lojas pede o **EAS Build** (compila o app na nuvem) e as contas da Apple (US$ 99/ano) e do Google (US$ 25). No Android publicado, o mapa precisa de uma chave do Google Maps no `app.json` (o Expo Go já tem uma). Nada disso foi feito nesta etapa.
