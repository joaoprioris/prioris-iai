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

## Decisões registradas em 23/10/2026

1. **Falso positivo aceito: 5%** (aprovado pelo proprietário). Vale para o teste global e, nos testes por par, como taxa de erro da família inteira (com correção para os 30 pares).
2. **Mapeamento dos prazos da matriz (proposta, a aprovar):** o ciclo é mensal, então a menor unidade é 1 mês. Janelas sem sobreposição, para o pré registro ficar limpo: imediata = 0 a 1 mês; curto = 2 a 3 meses; médio = 4 a 6 meses. Razões: o Mestre manda persistência de 2 ciclos, primeiro alerta após 3 meses e auditoria formal aos 6; um prazo "médio" além de 6 meses não seria verificável dentro do primeiro contrato. Os documentos só trazem as palavras (imediata, curto, médio), sem meses.
3. **Tamanho do piloto de validação (proposta, a aprovar):** ver a tabela de poder abaixo.

## Resultado da simulação de poder (lib/review/sim)

Premissas da simulação, que são hipóteses e não dados da empresa: contagens de Poisson por grupo e mês, com um pouco de heterogeneidade entre grupos; 70% dos SED trazem adjacência, sorteada entre as 3 da matriz (reproduz a circularidade); conversão injetada como aumento de RR vezes na chance de B ser a dívida principal um mês depois de pares A para B; teste com defasagem de 1 mês; aproximação normal. Cada linha abaixo usa 300 simulações.

**Teste global** (um único teste: "a adjacência registrada antecipa B como principal?"), nível de 5%, efeito em todos os 30 pares. A taxa de falso positivo ficou entre 0,7% e 5,3% em todas as combinações (calibrado, levemente conservador).

| Grupos | Meses | SED por grupo e mês | Poder se RR = 1,5 | Poder se RR = 2,0 |
|---|---|---|---|---|
| 10 | 6 | 8 | 36% | 81% |
| 10 | 9 | 8 | 67% | 97% |
| 10 | 12 | 8 | 83% | 100% |
| 20 | 6 | 8 | 66% | 98% |
| 20 | 9 | 8 | 88% | 100% |
| 10 | 9 | 16 | 99% | 100% |
| 20 | 9 | 4 | 46% | 86% |
| 40 | 12 | 4 | 79% | 99% |

Leitura: o que manda é a quantidade total de SED publicados (grupos x meses x SED por grupo e mês). Cerca de 1.000 a 1.500 SED publicados dão 80% a 90% de poder para detectar um aumento de 50% (RR 1,5), no teste global. Poucos grupos com muitos eventos funcionam melhor que muitos grupos com poucos eventos.

**Teste por par** (30 pares x 2 defasagens, correção de Bonferroni, nível de família de 5%): o poder só passa de 80% com 80 grupos, 16 SED por grupo e mês, 12 meses e efeito RR 2,0 (89%). Com a aproximação normal, a taxa de falso positivo da família chegou a 11% a 14% nos cenários de poucos dados (5 grupos, 4 SED por grupo e mês, 9 a 12 meses), então o teste de produção precisa usar permutação em blocos.

Consequências para o desenho:
- **Teste em dois níveis:** primeiro o teste global; só se ele passar se testam os pares, e os pares só viram "confirmados" com dados de vários clientes.
- **Defasagens:** com 6 meses de piloto, defasagem de 3 meses deixa 3 meses de resultado; só imediata e curto são testáveis. O prazo médio exige 12 meses.
- **Medir antes de dimensionar:** o SED por grupo e mês é a premissa mais incerta. Medir nos 2 primeiros meses do piloto e só então fixar o tamanho final.

## Decisões que cabem ao proprietário

1. Aprovar o mapeamento de prazos proposto acima.
2. Aprovar o tamanho do piloto de validação proposto acima.
3. Critério de promoção a "confirmado" (quantos clientes, quantos ciclos, que ganho preditivo).
