# Guia das skills e agentes do Claude

Você não precisa decorar nomes. Basta escrever uma frase parecida com as de baixo e o Claude escolhe sozinho. Se quiser forçar, digite `/nome-da-skill` (só skills) ou "usa o agente nome-do-agente".

**Skill** = um roteiro que o Claude segue na própria conversa.
**Agente** = um "ajudante" separado que só lê o código e devolve um relatório, sem mudar nada.

## Skills

| Skill | Para que serve | Frases que chamam |
| --- | --- | --- |
| `nova-migracao` | Mudar o banco do jeito seguro e te guiar no SQL Editor | "Cria uma migração para ...", "Muda a regra da multa no banco", "Adiciona uma coluna X" |
| `conferir-migracoes` | Descobrir o que já está aplicado no Supabase | "Confere se as migrações estão aplicadas", "A migração da caixinha foi aplicada?" |
| `abrir-no-expo-go` | Ligar o app e abrir no Expo Go do celular | "Abre o app no celular", "Roda no Expo Go", "Sobe o app" |
| `verificar-app` | Rodar os testes certos conforme o que mudou | "Testa tudo", "Verifica se o app ainda compila", "Está tudo funcionando?" |
| `rodar-e2e-e-limpar` | Teste contra o banco real e SQL de limpeza | "Roda o teste de ponta a ponta", "Limpa as contas de teste" |
| `nova-tela` | Criar tela no app no padrão do projeto | "Cria uma tela de ranking", "Adiciona uma aba de estatísticas" |
| `pre-lancamento` | Caminho até TestFlight e lojas | "O que falta para lançar?", "Como coloco no TestFlight?", "Quero instalar sem o computador" |
| `git-commit` (já existia) | Regras de commit e push | "Faz o commit e o push" |

## Agentes (só leem e relatam)

| Agente | Para que serve | Frases que chamam |
| --- | --- | --- |
| `revisor-regras-dinheiro` | Conferir se o placar do app calcula igual ao banco | "O placar bate com o banco?", "Revisa as regras da multa" |
| `auditor-rls` | Segurança: um grupo não ver dados de outro | "O app está seguro?", "Alguém de fora vê nossas fotos?" |
| `cacador-de-datas` | Achar bug de fuso e dia errado | "O check-in caiu no dia errado", "Tem bug de fuso?" |
| `revisor-de-privacidade` | LGPD e formulários das lojas | "Preciso de política de privacidade", "O app está de acordo com a LGPD?" |

Dá para pedir vários agentes juntos: "roda o auditor-rls e o cacador-de-datas em paralelo".

## Automático (hook)

Quando o Claude termina uma resposta, `typecheck-ao-parar` roda o `typecheck` nas pastas com arquivo `.ts`/`.tsx` alterado. Se der erro, o Claude é obrigado a ver e corrigir. Ele só roda se `node_modules` existir na pasta. Para desligar, apague o bloco `Stop` em `.claude/settings.json`.

## Combinações úteis

- Mudar uma regra: `nova-migracao` → `revisor-regras-dinheiro` → `verificar-app` → `conferir-migracoes` depois de aplicar.
- Antes de lançar: `auditor-rls` + `cacador-de-datas` + `revisor-de-privacidade` em paralelo → `pre-lancamento`.
