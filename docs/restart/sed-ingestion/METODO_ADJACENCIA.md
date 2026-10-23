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

1. **Falso positivo aceito: 5%** (aprovado). Vale para o teste global e, nos testes por classe de prazo, como taxa de erro da família.
2. **Prazos da matriz (aprovado):** imediata = 0 a 1 mês; curto = 2 a 3 meses; médio = 4 a 6 meses. No teste, o mês zero é excluído da exposição (ver a nota técnica abaixo).
3. **Tamanho do piloto:** aprovado 10 grupos por 12 meses, mas a segunda rodada de simulação (início gradual) pede revisão, ver a tabela. 
4. **Critério de promoção a "confirmado":** proposto abaixo, a aprovar.

## Como a conversão é modelada (correção do proprietário)

A dívida adjacente **não** aparece como principal já no mês seguinte. Ela pode começar a aparecer e só se consolida depois. A simulação passou a refletir isso:

- **Efeito gradual por prazo:** antes da janela do prazo, nenhum efeito; dentro da janela, o efeito sobe por degraus; depois da janela, o efeito está consolidado e permanece.
- **Exposição acumulada:** o teste não olha só o mês anterior. Para cada par, soma os pares A para B observados desde o início da janela do prazo (nunca antes de 1 mês) até 6 meses atrás.
- **Mês zero excluído:** pares e desfecho do mesmo mês compartilham o mesmo volume de SED e geram correlação mecânica. A exposição usa sempre meses anteriores, e o desfecho é a participação de B entre os SED do mês (isso remove o efeito do volume).
- **Permutação correta:** o p valor vem de embaralhar a ordem dos meses de cada grupo, mantendo juntos o par e o desfecho do mesmo mês. Um primeiro desenho (deslocar só o desfecho) deu 28% de falso positivo e foi descartado; o desenho atual ficou calibrado (média de 4,4% nos 27 cenários, com 120 simulações cada, erro de amostragem de cerca de 4 pontos percentuais por célula).
- **Desfecho secundário, "consolidação":** B acima da linha de base do próprio grupo por 2 ciclos consecutivos, que é a regra de persistência já vigente no sistema. É o que mede se a conversão virou padrão, não só aumento passageiro.

## Resultado da simulação de poder (lib/review/sim/power2.mjs)

Premissas, que são hipóteses e não dados da empresa: contagens de Poisson por grupo e mês, com heterogeneidade entre grupos; 70% dos SED trazem adjacência, sorteada entre as 3 da matriz com os prazos do Mestre (6 imediata, 11 curto, 13 médio); conversão com início gradual e consolidação tardia; efeito de RR vezes na chance de B ser principal.

Poder do **teste global** (um teste, nível de 5%, permutação) para detectar RR de 1,5 e de 2,0:

| Grupos | Meses | SED por grupo e mês | RR 1,5 | RR 2,0 |
|---|---|---|---|---|
| 10 | 6 | 8 | 23% | 50% |
| 10 | 9 | 8 | 48% | 80% |
| **10** | **12** | **8** | **65%** | **97%** |
| 20 | 9 | 8 | 74% | 98% |
| **20** | **12** | **8** | **91%** | **100%** |
| 10 | 12 | 16 | 75% | 97% |
| 20 | 9 | 16 | 82% | 100% |
| 40 | 9 | 8 | 90% | 100% |
| 40 | 12 | 4 | 85% | 100% |

Com o início gradual, o poder cai em relação à primeira simulação (que supunha efeito já no mês seguinte): 10 grupos por 12 meses com 8 SED por grupo e mês passa de 83% para 65% em RR 1,5. Para 80% ou mais em RR 1,5, a opção mais enxuta é **20 grupos por 12 meses** (91%); com 16 SED por grupo e mês bastam 20 grupos por 9 meses (82%).

## Proposta de critério de promoção (a aprovar)

Níveis, do mais fraco ao mais forte. Cada nível só vale se todos os critérios dele passarem, e **nenhum critério pode ser alterado depois de olhar os dados**.

| Nível | Nome | O que é exigido |
|---|---|---|
| 0 | Hipótese | Está na matriz oficial. É o ponto de partida. |
| 1 | Sinal interno | Em um cliente: qualidade de dados aprovada (abaixo) e teste global com p menor que 5%. |
| 2 | Candidato | O sinal se repete em dados novos (período seguinte do mesmo cliente) e em pelo menos mais um cliente, com o mesmo sentido. |
| 3 | Confirmado interno | Todos os critérios do bloco "Para confirmar", abaixo. |
| 4 | Exibível ao cliente | Decisão separada do proprietário, só depois de 2 apurações semestrais consecutivas no nível 3, revisão ética e jurídica da linguagem e teste de compreensão com RH. |

**Qualidade de dados (porta de entrada, vale para todos os níveis):** grupos com pelo menos 3 participantes distintos; maturidade N2 ou superior; estabilidade do classificador de SED medida por repetição (classificar a mesma situação várias vezes e com mais de um modelo), com concordância de pelo menos 0,61 (kappa, convenção de "concordância substancial"); sem deriva de base (todos os scores subindo juntos sem padrão claro).

**Para confirmar (nível 3):**
1. Pelo menos **3 clientes independentes**, nenhum com mais de 50% dos SED do conjunto.
2. **Teste global** agregado com p menor que 5%, calculado em dados que **não** foram usados para descobrir o padrão (separar por cliente ou por tempo).
3. **Efeito mínimo de interesse: RR de 1,5**, com limite inferior do intervalo de 95% acima de 1,0. (É o menor efeito que o piloto de 20 grupos por 12 meses detecta com 90% de poder.)
4. **Mesmo sentido em pelo menos 2 de cada 3 clientes**, sem heterogeneidade extrema.
5. **Ganho de previsão fora da amostra:** o erro de previsão (Brier) com a adjacência é menor que o do modelo que usa só o histórico de B, com intervalo de 95% da melhora acima de zero.
6. **Controle negativo:** nos 60 pares fora da matriz, a taxa de "descoberta" é no máximo a esperada (5%), com tolerância de teste binomial. Acima disso o método é considerado inválido.
7. **Placebo de tempo:** com a ordem dos meses embaralhada, o sinal desaparece.
8. **Desfecho de consolidação (secundário):** a chance de B se consolidar (2 ciclos consecutivos acima da linha de base) é maior nos grupos expostos.
9. **Revisão externa** por estatístico independente e **ata do Founder**, como já exige a regra de mudança de parâmetro.

**Pares individuais:** em vez de 30 testes, 3 testes por **classe de prazo** (6 imediatas, 11 curtas, 13 médias), com correção para 3. Um par só ganha status próprio com dados de vários clientes. Até lá, vale o status da classe.

**Rebaixamento:** se o teste de confirmação falhar em 2 apurações seguidas com dados novos, o nível cai para 2 e o motivo vai para a ata.

## Decisões que cabem ao proprietário

1. Aprovar o tamanho do piloto revisado (20 grupos por 12 meses, ou 10 grupos por 12 meses se o volume real passar de 16 SED por grupo e mês).
2. Aprovar o critério de promoção proposto.
