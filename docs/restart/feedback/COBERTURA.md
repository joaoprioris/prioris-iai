# Cobertura dos cenários de teste sobre a biblioteca de 80 momentos

Fonte dos momentos: arquivo "Agente 5 — Feedback Estruturado" da pasta AGENTES do Drive (80 momentos, 20 por custo, cada um com fase e dívida). Está em `artifacts/api-server/src/feedback/moments.ts`. Esta é a fonte do denominador: a pasta IMPLEMENTAÇÃO registra 390 unidades principais (80 de Perfil, Impacto, Feedback e 1:1, e 70 de Crises). O arquivo "MOMENTOS DE ATIVAÇÃO CORRIGIDO" (168 registros) e o Guia de Conversão (10) são 178 registros complementares preliminares, fora desse denominador; suas listas de Top 10 diferem.

O mapeamento cenário a momento foi feito por leitura (não há marcador nos cenários). Está em `eval/coverage.ts` e é validado por `eval/coverage.test.ts`.

## Estado atual (14 cenários)

8 momentos reproduzidos com fidelidade, 7 de 12 células (custo x fase) e 6 de 10 dívidas.

| Custo | Antes | Durante | Depois |
|---|---|---|---|
| Paralisia | `adiando-ha-semanas` (11), `feedback-recebido-injusto` (2) | **sem cenário** | `boa-conversa-nada-muda` (8) |
| Retrabalho | `feedback-para-senior` (28) | **sem cenário** | `interpretado-como-elogio` (26) |
| Cinismo | **sem cenário** | **sem cenário** | `mesmo-feedback-tres-vezes` (60) |
| Ruptura | `ativado-emocionalmente` (61) | `reacao-defensiva-agora` (65) | **sem cenário** |

Dívidas sem nenhum cenário: Accountability Diluída, Alinhamento Simbólico, Confiança Erosionada e Maturidade Política Insuficiente.

Cenários sem momento equivalente (testam regras do agente, não momentos da biblioteca): `quer-fala-pronta`, `reconhecimento`, `preparar-objecoes`, `impressao-versus-fato`. Aproximados: `cobranca-relacional` (caso de referência do proprietário, mais próximo do momento 11) e `algo-errado-sem-nome` (estado Vazio, que a biblioteca não tem; mais próximo do momento 55).

## Cenários propostos (rodados uma vez em 23/10/2026)

Cinco cenários em `eval/proposed-scenarios.ts` fecham todas as células e todas as dívidas (12 de 12 e 10 de 10). Não fazem parte de `SCENARIOS`; rodam com `--proposed`. Uma rodada de cada, Haiku 5.5 como agente, líder simulado e avaliador, gasto de US$ 0,04 (88 chamadas). Texto integral e veredito em `docs/restart/feedback/rodada-cenarios-propostos/`.

Resultado do critério duro: **1 aprovada de 5**. Uma rodada por cenário é amostra mínima e as transcrições ainda não foram lidas por pessoa; nada disso conta como aprovado e lido.

| Cenário | Resultado | Motivo da reprovação |
|---|---|---|
| `mensagem-se-perdeu` | reprovada (3 trocas, nota 4, utilidade 4) | problema grave `garantiu_reacao`: "ele vai soar como preparação para a crítica" |
| `retro-sem-comportamento` | reprovada (8 trocas, nota 3, utilidade 3) | graves `fala_pronta_excessiva`, `inventou_fato` e `presumiu_sentimento_ou_reacao`; o líder reclama de condução por frases prontas |
| `avaliacao-para-reter` | reprovada (10 trocas, nota 4, utilidade 4) | só `estilo: resposta_longa` |
| `elogio-suspeito` | aprovada (7 trocas, nota 4, utilidade 4) | ressalvas leves (`presumiu_sentimento_ou_reacao`, `garantiu_reacao`) |
| `honestos-marcados` | reprovada (5 trocas, nota 3, utilidade 3) | respostas genéricas que presumem decisões que o líder ainda pensava |

Os padrões repetem os dos cenários antigos: presumir reação do outro, frase pronta em excesso e fato inventado. Próximo passo sugerido, sem executar: ler as transcrições dos reprovados com nota 3, ajustar a orientação e rodar de novo só esses cenários.

Mapa dos cenários propostos:

| Cenário proposto | Momento | Fase | Dívida |
|---|---|---|---|
| `mensagem-se-perdeu` | 5 | Durante | Evitação de Conflito |
| `retro-sem-comportamento` | 37 | Durante | Accountability Diluída |
| `avaliacao-para-reter` | 41 | Antes | Alinhamento Simbólico |
| `elogio-suspeito` | 52 | Durante | Confiança Erosionada |
| `honestos-marcados` | 80 | Depois | Maturidade Política Insuficiente |

## Sobre o `feedback-recebido-injusto`

É o único cenário de feedback recebido que reproduz um momento da biblioteca (o 2). Os momentos 32, 52, 57 e 66 também são de feedback recebido. Abandonar o cenário deixa o momento 2 sem cobertura. Decisão do proprietário: continuar tentando ou registrar a pendência.

## Matriz de lentes

A matriz de lentes entre agentes está estruturada em `artifacts/api-server/src/agents/lenses.ts` e conferida por teste contra o bloco de lentes de cada agente em `lib/agent-contract.json`. Para o Feedback: Impacto moderada, Mentor leve, Contenção leve; nunca Crises nem 1:1.

## Relação com a campanha anterior (Replit)

A campanha documentada na pasta IMPLEMENTAÇÃO exercitou 12 das 390 unidades principais, 2 delas de Feedback, sem aprovação integral de nenhuma conversa. Não há como saber quais 2 dos 80 momentos foram essas; esta cobertura é só dos 14 cenários deste repositório e não soma com aquela. Os controles de custo daquela campanha (teto de US$ 5 do piloto Replit) são separados do teto de US$ 5 desta avaliação.
