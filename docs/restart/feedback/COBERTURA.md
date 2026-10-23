# Cobertura dos cenários de teste sobre a biblioteca de 80 momentos

Fonte dos momentos: arquivo "Agente 5 — Feedback Estruturado" da pasta AGENTES do Drive (80 momentos, 20 por custo, cada um com fase e dívida). Está em `artifacts/api-server/src/feedback/moments.ts`. Esta versão é a vigente: o arquivo "MOMENTOS DE ATIVAÇÃO CORRIGIDO" é anterior e tem listas diferentes (decisão do proprietário a registrar; hipótese de trabalho: superado).

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

## Cenários propostos (não rodados)

Cinco cenários em `eval/proposed-scenarios.ts` fecham todas as células e todas as dívidas (12 de 12 e 10 de 10). Não fazem parte de `SCENARIOS`: rodar custa API e depende de decisão do proprietário. Saldo estimado do teto: cerca de US$ 1,97 de US$ 5.

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
