# Agente de Feedback, Fase 1: estado do trabalho (PR 3)

Registro para retomar sem perder contexto. Branch: `claude/funny-allen-6z18ab`. Nada foi gravado como SED. O PR 2 não foi tocado. Só o dono faz merge.

## Decisões do dono que valem

- Os 80 momentos do arquivo "Agente 5 Feedback Estruturado" são do agente de Feedback. Contenção entra como lente leve. O MIC já está na orientação. Lentes de antifragilidade ficam para depois.
- Não gravar SED enquanto as conversas não estiverem boas, nem SED provisório.
- Nunca usar as palavras de tratamento clínico ou de profissional de saúde mental em texto de produto.
- Teto TOTAL de US$ 10 em API (o dono liberou mais US$ 5 em 23/10/2026, com controle rigoroso de gasto). Gasto acumulado registrado pela trava: cerca de US$ 3,07. Rodar sempre com `--cap 10 --spent-before <gasto acumulado>`.
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
- `b19faa8` guardas de cansaço e pergunta repetida, abertura curta permitida, este registro
- Commit seguinte: pausa repetida, citação não pedida, sinais de cansaço ampliados, 13 de 14 cenários com conversa aprovada

## Situação final desta etapa (rodadas 25 a 33)

Cenários com conversa aprovada e lida com o código atual: 13 de 14. Os três que faltavam foram resolvidos assim:

- `feedback-para-senior`: aprovada com ressalvas (r24).
- `impressao-versus-fato`: aprovada com ressalvas (r26).
- `quer-fala-pronta`: aprovada (r33), depois de permitir uma única abertura curta quando o líder pede, de proibir consequência inventada nos exemplos e de adicionar o sinal de cansaço com "roteiro" e "frase pronta".
- `feedback-recebido-injusto`: **continua aberto.** Em 12 tentativas com o código atual, nenhuma foi aprovada. Os motivos se repetem: o líder simulado tira nota 3 porque o agente entrega frases prontas que ele não pediu, empurra o líder a pensar em coisas que ele diz não saber se existem, repete a mesma orientação e resume como se o líder já tivesse decidido tudo. A melhor tentativa foi a r33 (5 trocas, utilidade 4, nota 3).

Ajustes feitos nesta etapa: detecção de cansaço do líder (injeta resposta curta e sem pergunta), pergunta repetida, pausa ou respirar sugerida uma vez só, citação entre aspas não pedida, limite de fala inteira de 70 para 150 caracteres. Testes: 33 passando; sem erro de tipo nos arquivos do Feedback; instalação feita depois do merge da main (725fac3).

Números totais até aqui: 312 conversas iniciadas, 12 falhas técnicas (todas nas primeiras rodadas, corrigidas). Gasto acumulado pela trava: cerca de US$ 3,03 de US$ 5.

## Para retomar

```
cd artifacts/api-server
pnpm install --filter @workspace/api-server... --frozen-lockfile
pnpm run test:feedback
PRIORIS_FEEDBACK_MODEL=claude-haiku-5-5 node src/feedback/eval/run-eval.ts \
  --out <pasta fora do repositório> --cap 10 --spent-before 3.07 \
  --only feedback-recebido-injusto
```

1. Ler `.claude/skills/avaliar-agente-conversacional/SKILL.md`.
2. Rodar duas ou três rodadas só nos dois cenários que faltam, agregar os motivos de reprovação e ler as transcrições dos reprovados com nota 3.
3. Só falta `feedback-recebido-injusto`.
4. `feedback-recebido-injusto`: o líder fica cansado de perguntas e de frases sugeridas; o agente tende a conduzir demais a escrita.
5. Só considerar fechado quando houver conversas aprovadas e lidas desses cenários com o código atual.
6. Decisões abertas para o dono: manter o critério duro (aprovação automática baixa, medida fiel) e decidir se mantém Haiku ou outro modelo em produção (Sonnet 5.5 aprovou o mesmo número de cenários, a cerca de 7 vezes o custo).

## Atualização (leitura da pasta AGENTES do Drive)

- `src/feedback/moments.ts`: os 80 momentos do Agente 5 (fase, dívida e custo). Contagem por custo e por dívida verificada por teste.
- `src/feedback/eval/coverage.ts` e `docs/restart/feedback/COBERTURA.md`: cobertura dos 14 cenários sobre os 80 momentos (7 de 12 células e 6 de 10 dívidas) e 5 cenários propostos, não rodados, que fecham os buracos.
- `src/agents/lenses.ts`: matriz de lentes entre agentes, conferida contra `lib/agent-contract.json`.
- Nenhuma chamada de API foi feita nesta etapa.

## Atualização de 23/10/2026 (cenários propostos)

- Runner ganhou `--proposed`. Os 5 cenários propostos rodaram uma vez: 1 aprovada, 4 reprovadas (detalhes em `COBERTURA.md`; transcrições em `rodada-cenarios-propostos/`). Gasto desta rodada: US$ 0,04. Acumulado: cerca de US$ 3,07 de US$ 10.
- Transcrições ainda não lidas por pessoa.
