---
name: abrir-no-expo-go
description: Liga o servidor do app nativo (npx expo start) e leva o dono do projeto até ver o app aberto no Expo Go do iPhone ou Android, explicando cada passo e o que fazer se o celular não conectar. Use quando o usuário disser "abre o app no celular", "roda no Expo Go", "como testo no meu iPhone", "sobe o app", "quero ver o app funcionando", "conecta no Expo Go".
---

# Abrir o app no Expo Go

O dono do projeto não conhece Expo. Explique em português simples, um passo por vez, com o que ele deve ver na tela.

## O que é cada coisa (diga na primeira vez)

- **Expo Go**: app grátis (App Store e Google Play) que abre o nosso app no celular sem publicar nas lojas.
- **Servidor do Expo** (`npx expo start`): programa no computador que entrega o app ao celular. **O app só abre enquanto ele estiver rodando** e o computador ligado.
- **Endereço `exp://...`**: o "endereço" do servidor na rede da casa. O Expo Go se conecta a ele sozinho (lista de servidores) ou pela digitação.

## Passos

1. **Só confira, não reinstale nada.** O projeto já está configurado: **não rode `npm install`, `npx expo install` nem `expo login` por conta própria**. Só olhe:
   - `mobile/.env.local` existe (URL e chave anon do Supabase). Se faltar, pare e avise: sem ele o app abre em erro. Nunca mostre o conteúdo da chave.
   - `mobile/node_modules` existe. **Só se a pasta não existir** (máquina nova) rode `npm install` em `mobile/` e avise que é a primeira vez.
   - A porta 8081: se já houver um servidor Expo rodando (`netstat -ano | grep :8081`), **reaproveite-o** e vá direto ao passo 3, sem abrir outro.
2. **Suba o servidor em segundo plano** (Bash, `run_in_background`), de dentro de `mobile/`:
   ```
   EXPO_NO_TELEMETRY=1 npx expo start --port 8081
   ```
   Não use `CI=1`: ele desliga a recarga automática. Espere uns 30 segundos e leia o log até aparecer `Waiting on http://localhost:8081`. Fora de um terminal interativo o Expo **não imprime** o `exp://`: monte o endereço com o IP do Wi-Fi do computador (`ipconfig`, linha "IPv4" do adaptador Wi-Fi): `exp://<IP>:8081`. Teste com `curl -H "expo-platform: ios" http://<IP>:8081/` (deve responder um JSON).
3. **Entregue a conexão, sem QR code.** Não gere QR, nem imagem, nem arquivo no projeto: ele não é necessário. Diga ao dono, nesta ordem:
   - **Primeiro tente assim:** abrir o Expo Go no celular (mesmo Wi-Fi). Na tela inicial, em **Development servers**, aparece o servidor do computador. Tocar nele abre o app. **[Provável]**: depende de a rede deixar o celular enxergar o computador.
   - **Se não aparecer:** tocar em **Enter URL manually** e digitar o `exp://<IP>:8081`. Escreva o endereço completo em texto na resposta.
4. **Avise as condições:** celular e computador no **mesmo Wi-Fi**; conta Expo (grátis) logada no Expo Go; computador ligado e sem suspender.
5. Para **parar**: encerre o processo em segundo plano (TaskStop) ou, no terminal do dono, `Ctrl+C`.

## Se der errado

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Celular fica carregando ou "não foi possível conectar" | Wi-Fi diferente, rede com isolamento de aparelhos (comum em Wi-Fi de prédio ou 5G separado) ou firewall do Windows | Conferir o Wi-Fi; permitir o Node.js no firewall quando o Windows perguntar; tentar `npx expo start --tunnel` (pede para instalar `@expo/ngrok`: responder `y`; é mais lento) |
| "Port 8081 is being used" | Outro servidor Expo aberto | Fechar o outro ou usar `--port 8082` |
| Tela vermelha "Supabase não configurado" | Falta `mobile/.env.local` | Recriar com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (a chave anon está no painel do Supabase, em Project Settings > API) |
| Erro vermelho no app | Bug | Pedir uma foto da tela e investigar |
| Pede login do Expo | Conta Expo não logada | `npx expo login` no computador; no celular, entrar no Expo Go com a mesma conta |

## Lembretes

- O Expo Go **não** testa notificações push nem pacotes nativos fora da lista dele. Para isso é preciso um build próprio (ver a skill `pre-lancamento`).
- Se o app mostrar que falta o objetivo da caixinha ou a chave Pix der erro, pode ser a migração `kitty_goals` ainda não aplicada (ver `conferir-migracoes`).
- Para não depender do PC: publicar na nuvem do Expo (grátis) ou TestFlight (conta Apple paga). Ver `pre-lancamento`.
- Termine dizendo se o servidor ficou rodando em segundo plano, para o dono saber que o computador precisa ficar ligado.
