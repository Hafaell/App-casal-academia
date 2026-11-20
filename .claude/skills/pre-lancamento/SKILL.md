---
name: pre-lancamento
description: Checklist e passo a passo para levar o app ao TestFlight, App Store e Google Play (EAS, contas de desenvolvedor, privacidade, exclusão de conta, ícones, capturas), explicando cada termo para quem nunca publicou app. Use quando o usuário disser "quero publicar o app", "como coloco na App Store", "TestFlight", "Play Store", "o que falta para lançar", "instalar sem o computador".
---

# Pré-lançamento nas lojas

O dono do projeto nunca publicou app. Siga as regras do CLAUDE.md: um passo por vez, o que é cada ferramenta, onde clicar, e **avise antes de qualquer custo ou conta nova**.

## Frases que chamam esta skill

- "O que falta para lançar o app?"
- "Como coloco o app no TestFlight?"
- "Quero instalar o app sem precisar do computador"
- "Como publico na Play Store?"

## Antes de tudo

1. Leia `app-comerciavel.md` (plano, custos e decisões já tomadas) e o PROGRESSO.md.
2. As regras das lojas e do EAS mudam. Confira na documentação atual (docs.expo.dev, developer.apple.com, support.google.com/googleplay) antes de afirmar requisito, preço ou prazo, e marque o grau de confiança.
3. Pergunte qual é o objetivo, porque o caminho muda:
   - **Só o casal, sem PC ligado**: publicar no Expo (EAS Update) e abrir pelo Expo Go. Grátis.
   - **iPhone com app próprio**: TestFlight, exige Apple Developer (US$ 99/ano).
   - **Lojas públicas**: tudo abaixo.

## Checklist (marque o que já existe no projeto)

### Contas e custos (avisar antes)
- [ ] Conta Expo (grátis) e EAS. O build sai pela nuvem do Expo, porque o PC é Windows e não tem Xcode.
- [ ] Apple Developer Program: US$ 99/ano.
- [ ] Google Play Console: taxa única de US$ 25.

### Exigências das lojas
- [ ] **Exclusão de conta dentro do app** (Apple exige para apps com cadastro). Hoje não existe: precisa de tela e de função no banco (skill `nova-migracao`).
- [ ] **Política de privacidade** publicada numa URL (fotos, localização, e-mail). Peça o agente `revisor-de-privacidade`.
- [ ] Textos das permissões de câmera e localização em `mobile/app.json`, explicando o motivo em português.
- [ ] Formulários de privacidade: "App Privacy" (Apple) e "Data safety" (Google).
- [ ] Conta de teste para o revisor da Apple entrar no app.

### App
- [ ] Nome definitivo (hoje provisório), `ios.bundleIdentifier` e `android.package` em `mobile/app.json`. Não dá para trocar depois de publicar.
- [ ] Ícone 1024x1024, splash e capturas de tela nos tamanhos pedidos.
- [ ] Chave do Google Maps de produção, se a busca de academias for usada.
- [ ] Rodar a skill `verificar-app` e o agente `auditor-rls` antes do primeiro envio.

## Formato da resposta

Diga em que etapa o usuário está, o próximo passo único com o resultado esperado, e o que fazer se der errado. Não despeje o checklist inteiro de uma vez se ele só pediu o próximo passo.
