# Treino a Dois: melhorias que ainda faltam

Atualizado em 21/11/2026. Lista só com o que **ainda não foi feito**, numerada de novo (os números antigos não valem mais). Para pedir, basta dizer os números, por exemplo "faz o 1, 4 e 7".

**Já feito** (detalhes nos planos): treino juntos, caixinha com objetivo, relatório do mês, stories e colagem do ano ([plano-leva-1.md](./plano-leva-1.md)); roleta de prêmios, planejar a semana com o "vamos?", exceção com resposta do parceiro ([plano-leva-2.md](./plano-leva-2.md)); limite de exceções, desafio do mês, fotos de evolução ([plano-leva-3.md](./plano-leva-3.md)); confirmação do pagamento da multa, recuperar senha, exportar meus dados ([plano-leva-4.md](./plano-leva-4.md)).

**Descartado pelo Rafael:** treino automático pelo relógio, desafio (aposta) entre os dois, Pix copia e cola, parcerias.

Marcação: 🔒 = precisa do app compilado (conta Apple, US$ 99/ano), não funciona no Expo Go. 💰 = mexe em regra de dinheiro.

## Para o casal

1. **Vídeo do ano** com as fotos de treino (a colagem já existe; o vídeo é o item mais pesado).

## Notificações

2. 🔒 **Lembrete de treino** no celular, no horário que a pessoa planejou.
3. 🔒 **Aviso do fechamento da semana** e da punição sorteada.
4. 🔒 **"Seu parceiro treinou" e o "vamos?"** chegando como notificação (hoje aparecem só dentro do app).

## Grupos de amigos (só quando abrir para mais gente)

5. **Ranking do grupo.**
6. **Papéis:** só o dono edita regras e roleta (o campo `role` já existe).
7. **Remover membros e trocar o código de convite.**
8. **Convite seguro:** código mais longo, com validade e limite de tentativas.
9. **Placar, caixinha e feed pensados para mais de 2 pessoas.**
10. 💰 **Multa por grupo ou por pessoa** (decisão e mudança no fechamento da semana).

## Conta e segurança

11. **Excluir a conta dentro do app** (e por uma página web; exigido pelas lojas).
12. **E-mail próprio para o app (SMTP)**, por exemplo Resend (grátis, precisa criar conta). **Destrava a recuperação de senha**, que já está pronta no app: sem isso, o Supabase não deixa pôr o código de 6 números no e-mail e só manda para quem é da equipe do projeto. Depois dá para ligar a confirmação de e-mail.
13. **CAPTCHA** no cadastro e no login.
14. **Denunciar conteúdo para o desenvolvedor e bloquear usuário** (exigido pela Apple).
15. **Filtro de palavras** nas punições, prêmios e motivos.
16. **Entrar com Apple e com Google.**
17. **Exceção "Saúde" genérica** no lugar de "menstruação" (dado de saúde é sensível na LGPD).
18. **Senha com no mínimo 8 caracteres.**
19. **Zerar os alertas do Security Advisor e do Performance Advisor** do Supabase.

## Dados e fotos

20. **Apagar fotos de treino antigas** (ex.: 90 dias) e manter só a miniatura.
21. **Guardar menos localização:** só a distância e a academia, não a coordenada de cada treino.
22. **Limite de pedidos no `/api/maps-link`**, ou levar para uma função do Supabase e sair da Vercel.
23. **Busca de academias pelo nome no Google Maps** (falta ativar a chave).

## Qualidade e infraestrutura

24. **Leitor do teste do banco dentro do projeto**, para `npm run test:db` rodar neste PC sem `psql` (hoje roda por uma pasta temporária).
25. **Testes automáticos no GitHub** a cada push (CI).
26. **Tipos do banco gerados** pelo Supabase no lugar dos escritos à mão.
27. **Banco de testes separado** (staging), para o teste de ponta a ponta não usar o banco real.
28. **Sentry:** avisar quando o app der erro no celular de alguém.
29. **Alerta se o fechamento da semana falhar** e quando o uso chegar perto do limite grátis.
30. **Backup semanal do banco** guardado fora do Supabase.
31. **Tarefa diária que mantém o Supabase acordado** (o plano grátis pausa depois de ~7 dias parado).
32. **Dependabot:** aviso de atualização de pacotes.
33. **Testes de fluxo completo** no celular (Maestro).
34. **Revisão de acessibilidade** (leitor de tela, tamanho de letra, contraste).

## Para virar comercial

35. **Assinatura Premium** (RevenueCat) e tabela de Premium no banco.
36. **Métricas de uso** (PostHog): retenção e quantos casais seguem ativos.
37. **Links de convite que abrem o app** (precisa de domínio próprio).
38. **Painel de moderação** para ver as denúncias.
39. **Indicação:** quem convida ganha um mês de Premium.
40. **Páginas na web:** apresentação, política de privacidade e exclusão de conta.

## Decisões em aberto

41. **Raio do GPS:** ajustar os 100 m se o sinal dentro da academia atrapalhar.
42. **Giros acumulados da roleta:** quem já tinha várias semanas seguidas antes da atualização ganha os giros de uma vez. Manter ou contar só daqui para frente?
