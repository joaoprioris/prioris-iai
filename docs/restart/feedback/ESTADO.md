# Agente de Feedback, Fase 1: estado do trabalho (PR 3)

Registro para retomar sem perder contexto. Branch: `claude/funny-allen-6z18ab`. Nada foi gravado como SED. O PR 2 não foi tocado. Só o dono faz merge.

## Decisões do dono que valem

- Os 80 momentos do arquivo "Agente 5 Feedback Estruturado" são do agente de Feedback. Contenção entra como lente leve. O MIC já está na orientação. Lentes de antifragilidade ficam para depois.
- Não gravar SED enquanto as conversas não estiverem boas, nem SED provisório.
- Nunca usar as palavras de tratamento clínico ou de profissional de saúde mental em texto de produto.
- Teto TOTAL de US$ 5 em API. Gasto acumulado registrado pela trava: cerca de US$ 2,94.
- Iterar com `PRIORIS_FEEDBACK_MODEL=claude-haiku-5-5`. A chave está em `PRIORIS_API_KEY`; confirmar antes com a chamada gratuita de lista de modelos.

## Resultado entregue

- 10 conversas completas aprovadas, de 10 cenários diferentes, todas geradas pelo código atual (rodadas 19 a 24). Quatro limpas e seis com ressalvas. Texto integral e veredito de cada uma em `docs/restart/feedback/CONVERSAS_SIMULADAS.md`.
- Até a rodada 24: 290 conversas rodadas, 12 falharam por erro técnico (já corrigidos), 278 completas.
- Aprovadas no critério duro nas rodadas 17 a 24: 24 de 112 conversas.

## O que foi feito no código (`artifacts/api-server/src/feedback`)

- `guidance.ts`: orientação reescrita, curta e sem contradições; vocabulário vetado; `styleIssues` (abertura de validação, autocorreção, resposta acima de 150 palavras, fala inteira entre aspas acima de 150 caracteres, pergunta repetida, pergunta após cansaço do líder); instruções de reescrita.
- `conversation.ts` (`runTurn`): reescreve mostrando ao modelo o próprio rascunho e a correção, em até duas tentativas de estilo, uma para vocabulário vetado (erro sem consumir troca se persistir) e uma para fechamento com pergunta, com remoção da pergunta final se persistir. Injeta instrução de cansaço quando o líder reclama.
- `eval/judge.ts`: limite do avaliador 8000 tokens, tolerância a acento nos códigos, nova avaliação se o JSON vier malformado, checagens de estilo no critério de aceitação.
- `eval/simulated-leader.ts`: limite de 1200 tokens. `eval/run-eval.ts`: registra a causa das falhas do agente. `anthropic-provider.ts`: erro de resposta incompleta traz modelo, limite, saída e blocos.
- Testes: 31 passando (`pnpm run test:feedback` dentro de `artifacts/api-server`). Sem erro de tipo nos arquivos do Feedback.
- Skill com o aprendizado completo: `.claude/skills/avaliar-agente-conversacional/SKILL.md`.

## Commits na branch

- `f82f89e` guardas de vocabulário e fechamento, orientação reescrita, runner robusto
- `cc529f3` regras de estilo por código com reescrita que mostra o rascunho
- `3adea7c` skill do aprendizado
- Commit seguinte: guardas de cansaço e pergunta repetida, abertura curta permitida (ver abaixo)

## Em andamento quando a sessão foi pausada

Foco nos quatro cenários que ainda reprovam com frequência: `impressao-versus-fato`, `quer-fala-pronta`, `feedback-recebido-injusto`, `feedback-para-senior`.

Diagnóstico das rodadas 19 a 24: reprovam sobretudo por nota 3 do líder simulado, quando o líder está cansado ou impaciente e o agente continua perguntando, repete a mesma pergunta ou o mesmo conselho, ou recusa uma abertura curta que o líder pediu várias vezes. Ajustes feitos: instrução de cansaço (sem pergunta, até 70 palavras, uma abertura de até 20 palavras se pedida), detecção de pergunta repetida, limite de "fala inteira" subido de 70 para 150 caracteres, e o prompt volta a permitir uma abertura curta quando o líder pede (a orientação original do dono já permitia exemplos curtos e adaptáveis).

Resultado parcial das rodadas 25 a 27 (só os quatro cenários, interrompidas): aprovadas 2 de 10. `impressao-versus-fato` passou em r26, `feedback-para-senior` passou em r27. `quer-fala-pronta` e `feedback-recebido-injusto` não passaram nenhuma vez nessas rodadas. Ainda não li as transcrições dessas rodadas.

Nota: `feedback-para-senior` já tinha conversa aprovada e lida (r24, com ressalvas), então esse cenário pode ser considerado resolvido.

## Para retomar

```
cd artifacts/api-server
pnpm install --filter @workspace/api-server... --frozen-lockfile
pnpm run test:feedback
PRIORIS_FEEDBACK_MODEL=claude-haiku-5-5 node src/feedback/eval/run-eval.ts \
  --out <pasta fora do repositório> --cap 5 --spent-before 2.94 \
  --only quer-fala-pronta,feedback-recebido-injusto
```

1. Ler `.claude/skills/avaliar-agente-conversacional/SKILL.md`.
2. Rodar duas ou três rodadas só nos dois cenários que faltam, agregar os motivos de reprovação e ler as transcrições dos reprovados com nota 3.
3. `quer-fala-pronta`: o líder pede texto pronto e o agente precisa sustentar a autoria sem soar duro; o que falta é aliviar a recusa e dar a abertura curta mais cedo.
4. `feedback-recebido-injusto`: o líder fica cansado de perguntas e de frases sugeridas; o agente tende a conduzir demais a escrita.
5. Só considerar fechado quando houver conversas aprovadas e lidas desses cenários com o código atual.
6. Decisões abertas para o dono: manter o critério duro (aprovação automática baixa, medida fiel) e decidir se mantém Haiku ou outro modelo em produção (Sonnet 5.5 aprovou o mesmo número de cenários, a cerca de 7 vezes o custo).
