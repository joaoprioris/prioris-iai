# Método para calibrar o limiar de recorrência e validar a adjacência

Objetivo: decidir, com critério estatístico e sem chute, quando um par (dívida principal, dívida adjacente) indica que uma dívida está se convertendo em outra. O resultado fica interno ao motor até a correlação ser confirmada.

## O problema central: circularidade

A adjacência do SED é uma hipótese do classificador, tirada da matriz de interdependência. Um par A para B pode aparecer muito só porque a matriz oferece poucas opções de adjacente para A, e não porque a conversão exista. Logo, a frequência do par não prova nada sozinha. A prova de conversão precisa vir de dado independente do rótulo de adjacência:

1. B aparecer como dívida principal nos ciclos seguintes, no mesmo grupo.
2. As respostas da pesquisa silenciosa de B piorarem depois do par A para B.
3. O IEC de B subir depois.

## Etapas

| Etapa | O que fazer | Saída |
|---|---|---|
| 0. Pré registro | O proprietário define, antes de ver dados reais, o nível de falso positivo aceito, o critério de promoção a "confirmado" e o mapeamento dos prazos da matriz (imediata, curto, médio) em meses. | Critérios escritos e versionados |
| 1. Hipóteses | 30 pares da matriz oficial (3 adjacentes por dívida) são as hipóteses primárias. Os outros 60 pares ordenados são exploratórios e nunca viram alerta. | Lista fechada |
| 2. Simulação sem conversão (hipótese nula) | Gerar grupos e ciclos sintéticos em que as dívidas ocorrem sem relação entre si e a adjacência é sorteada da matriz, reproduzindo a circularidade. Medir com que frequência o detector (`emergingPairs`) dispara por acaso para cada combinação de mínimo de ciclos e mínimo de eventos. | Taxa de falso positivo por grupo e por ano |
| 3. Escolha do limiar | Escolher o menor par (ciclos, eventos) cuja taxa de falso positivo, com correção para os 30 testes (Benjamini e Hochberg, FDR), fique abaixo do nível definido na etapa 0. | `minConsecutiveCycles` e `minEventsPerCycle` |
| 4. Simulação com conversão | Repetir injetando conversão de tamanhos variados (a chance de B aparecer como principal sobe depois de A para B). Medir o poder de detecção. | Quantidade mínima de ciclos, grupos e eventos para poder de pelo menos 80% |
| 5. Teste nos dados reais | Modelo de contagem hierárquico (binomial negativa, efeito aleatório por grupo e cliente, tamanho do grupo como offset): contagem de B no ciclo t explicada por B em t menos 1, A em t menos L e o par A para B em t menos L, com L entre 0 e 3. Alternativa sem modelo: correlação cruzada defasada com teste de permutação em blocos, que preserva a autocorrelação. Controlar sempre pela frequência de A. | Efeito do par com intervalo de 95% |
| 6. Validação preditiva | Treinar até o ciclo t e prever B como principal em t mais L. Comparar com um baseline que usa só o histórico de B (Brier e AUC). | Ganho fora da amostra |
| 7. Promoção | O par só vira "confirmado" se passar nas etapas 5 e 6 de forma consistente em vários clientes, conforme o critério da etapa 0. Só então se discute exibir ao cliente. | Decisão do proprietário, em ata |

## Cuidados

- **Poucos pontos por grupo:** com 6 a 12 ciclos mensais, um grupo isolado tem poder baixo. Agrupar grupos e clientes no nível Prioris, usando apenas agregados já suprimidos (3 participantes distintos), e nunca cruzar identidades.
- **Correlação não é causa:** o resultado é "o par antecede B de forma consistente", não "A causa B". O texto oficial já diz que o sistema identifica correlação, não causalidade.
- **Dados reais só existem depois do piloto:** até lá, a simulação define o desenho e o tamanho mínimo da amostra. As etapas 2 a 4 podem rodar agora, sem custo de API.
- **Mudar parâmetro exige ata:** regra já vigente para parâmetros do motor.

## O que já existe no código

`lib/review/src/engine/adjacency.ts`: `trackPairs` e `emergingPairs` (detector, sem valores padrão) e a função `adjacency_release()` no banco. O que falta é o módulo de simulação das etapas 2 a 4 e o ajuste do detector aos resultados.

## Decisões que cabem ao proprietário

1. Nível de falso positivo aceito (sugestão a avaliar: 5%).
2. Mapeamento de imediata, curto e médio em meses (define as defasagens L).
3. Critério de promoção a "confirmado" (quantos clientes, quantos ciclos, que ganho preditivo).
4. Tamanho esperado do piloto (grupos, líderes, meses), para checar o poder antes de começar.
