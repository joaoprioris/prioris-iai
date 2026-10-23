# Método para validar a adjacência (versão 2)

Objetivo: decidir, com critério estatístico, quando a dívida A tende a se converter na dívida adjacente B, antes de mostrar qualquer coisa ao cliente. O resultado fica interno ao motor até haver confirmação.

**Situação:** a versão 1 foi submetida a uma auditoria externa independente (`AUDITORIA_ESTATISTICA_EXTERNA.md`, média 4,2 de 10, veredito "viável só para fase exploratória"). Esta versão 2 incorpora as correções aprovadas pelo proprietário em 23/10/2026. Ela ainda não passou por uma segunda auditoria. Até passar, vale como método da **fase exploratória**, nunca como base para exibir adjacência ao cliente.

## 1. O que a auditoria derrubou na versão 1 e o que foi feito

| Achado da auditoria | Gravidade | Situação na versão 2 |
|---|---|---|
| A supressão por célula do banco deixava 1,5% dos eventos de pares, e o poder caía ao nível do acaso | Crítico | Tratado: nova função `group_cycle_release()` (seção 3). Poder medido com e sem ela (seção 6) |
| Calibração só com dados independentes; falso positivo de 11% a 20% sob tendência, 7% a 10% sob persistência e choque comum | Crítico | Tratado: teste novo calibrado em 10 cenários não independentes (seção 5) |
| Não havia estimador de RR nem intervalo de confiança no código | Crítico | Estimador e intervalo implementados (`lib/review/sim/estimador.mjs`); o intervalo ainda subcobre, ver seção 5 |
| Critérios de promoção quebrados (Brier, placebo de tempo, controle negativo, "2 de 3 clientes") | Alto | Reescritos (seção 7) |
| Circularidade: IEC de B como desfecho e exposição pelo rótulo do classificador | Alto | IEC de B retirado como desfecho; exposição primária passa a ser a participação de A como dívida principal (seção 4) |
| "RR 1,5" era o pico do efeito, e o RR médio efetivo é bem menor | Alto | Todo número de poder agora diz que o RR é de pico (seção 6) |
| Prazo por classe sem poder e com janelas sobrepostas | Médio | Prazo declarado como não validado (seção 4) |
| Kappa de 0,61 custa poder | Médio | Mantido como porta de entrada; o tamanho final usa o kappa medido (seção 8) |
| Matriz de adjacência conferida só em parte contra o Mestre | Médio | Aberto (seção 9) |

## 2. Decisões do proprietário

1. **Falso positivo aceito:** 5%.
2. **Prazos da matriz:** imediata = 0 a 1 mês; curto = 2 a 3; médio = 4 a 6.
3. **Piloto em duas fases, sem tamanho fixo agora** (aprovado em 23/10/2026):
   * **Fase 1, medição, 2 meses.** Mede o volume real de SED por grupo, mês, dívida e participante distinto. Mede a concordância do classificador com uma amostra revisada por humanos. Calibra o estimador com o volume real. Nenhum resultado de adjacência é lido.
   * **Fase 2, exploratória, até 12 meses ou mais.** Roda o método e não promove nada acima do nível 1. O tamanho final é definido ao fim da fase 1, com o volume medido.
4. **Supressão:** saída 1, estatística agregada por grupo e ciclo (seção 3). O canal com eventos brutos fica descartado.
5. **Critério de promoção:** direção aprovada (seção 7). O texto final é validado na segunda auditoria.

## 3. Liberação de dados para a análise

A função `prioris_review.group_cycle_release()` entrega a contagem de SED por dívida principal, por grupo e ciclo encerrado, com a supressão aplicada ao grupo no ciclo (no mínimo 3 participantes distintos no total do grupo). Dentro do grupo liberado, as contagens por dívida saem completas.

* Só o papel do motor (`review_report`) executa; o papel de ingestão é recusado.
* Não vaza entre clientes (isolamento por `app.tenant`).
* O resultado nunca vai ao cliente e não sai do motor por grupo, apenas como estatística agregada entre grupos.
* A análise primária usa só essa função. Os pares rotulados continuam saindo de `adjacency_release()`, com supressão por célula, e servem apenas à análise secundária.
* Testes: `lib/review/test/database.test.ts`, incluindo grupo com 3 participantes (liberado, 1 por dívida) e grupo com 2 (suprimido). 52 testes, nenhuma falha, com PostgreSQL.

O que isso significa para a decisão C: o piso de 3 participantes distintos por grupo no ciclo continua valendo. O que muda é que a análise interna deixa de exigir 3 por dívida. O argumento de privacidade é que o dado é interno ao motor e só sai agregado entre grupos. Esse argumento deve ser revisado pelo jurídico antes da fase 2.

## 4. Desenho do teste

**Unidade de réplica:** o grupo. Meses e participantes dentro do grupo não são tratados como independentes.

**Exposição primária:** para cada par da matriz (A, B), a participação de A como dívida principal nos meses da janela do prazo, de 1 mês até 6 meses atrás, medida como média da participação de A entre os SED de cada mês. Ela não depende do rótulo de adjacência do classificador, o que corta a circularidade.

**Desfecho:** participação de B entre os SED do grupo no mês.

**Remoção de efeitos comuns:** exposição e desfecho são centrados por mês entre grupos do mesmo cliente. Isso remove tendência, sazonalidade e choque do cliente.

**Estimador direcional (primário):** para cada grupo, escore de defasagem (exposição passada) menos escore de avanço (a mesma exposição calculada com os meses seguintes). Se A e B variam juntas por causa comum persistente, os dois escores ficam iguais e a diferença se anula. Se A antecede B, só o escore de defasagem cresce. Este desenho substitui o "placebo de tempo" da versão 1, que era tautológico.

**Teste:** t de Student unilateral sobre os escores por grupo (G menos 1 graus de liberdade), nível de 5%.

**Efeito:** inclinação agrupada, com intervalo de 95% obtido por inversão do mesmo teste. O efeito é a variação da participação de B por unidade de exposição. O limiar de efeito mínimo de interesse **não está fixado**: será definido ao fim da fase 1, em escala padronizada, com o volume real, e congelado por hash antes de qualquer leitura (seção 7).

**Prazo:** o teste valida "A antecede B em até 6 meses". Ele não valida o prazo de cada classe, porque as janelas se sobrepõem e o poder por classe é baixo. Para validar prazos seria preciso um desenho novo, com janelas disjuntas, em fase posterior. Os testes por classe ficam como análise descritiva.

**Desfechos retirados:** o IEC de B (circular por fórmula) e o placebo de tempo.

**Exposição por pares rotulados:** análise secundária. Se for usada como primária por algum motivo, ela precisa ser declarada antes dos dados, porque a auditoria mediu falso positivo de 49% a 76% quando o classificador escolhe o adjacente segundo o que já está latente.

## 5. Calibração do erro tipo I (`lib/review/sim/fase2_*.mjs`)

Sob a hipótese nula (sem conversão), 20 grupos, 12 meses, 8 SED por grupo e mês, 800 simulações por cenário. Taxa de rejeição a 5% nominal:

| Cenário | Só defasagem (versão ingênua) | Direcional (primário) |
|---|---|---|
| Base (independente) | 4,4% a 6,3% | 5,4% a 6,6% |
| Autocorrelação forte (rho 0,9) | 0,0% a 0,4% | 3,9% a 6,1% |
| Tendência comum | 5,4% a 6,0% | 6,5% a 7,0% |
| Choque mensal comum | 4,8% | 4,3% |
| Classificador circular com persistência | 0,3% | 4,5% |
| Causa comum persistente fraca | 9,8% | 5,6% |
| Causa comum persistente média | 25,3% | 5,3% |
| Causa comum persistente forte | 49,1% | 5,6% |
| Todos os problemas juntos | 3,0% | 5,4% |

Leitura:

* O teste só de defasagem parece calibrado nos cenários da versão 1, mas **falha de 10% a 49% sob causa comum persistente**, o cenário mais plausível em dado real (dívidas vizinhas variam juntas por motivos comuns). Por isso o primário é o direcional.
* O direcional ficou entre 3,9% e 7,0% em todos os cenários. A margem de erro de cada célula é de cerca de 1,5 ponto. Ele não é exatamente 5%, e pode ser levemente liberal. Essa folga fica registrada, e é uma das razões pelas quais a confirmação exige replicação entre clientes (seção 7).
* O intervalo de 95% do efeito cobre zero em 91% a 93% das simulações sob a nula (nominal 95%). Ele subcobre em cerca de 2 a 4 pontos. Até ser corrigido ou validado de outro modo, o intervalo é informativo e o critério usa o p valor.
* A calibração da família de 3 testes por classe de prazo não foi refeita para o direcional.
* **Limite:** os cenários de causa comum, tendência e persistência são hipóteses minhas, não dados da empresa. Não sei com que frequência ocorrem.

## 6. Poder (`lib/review/sim/fase2_poder.mjs`, 300 simulações por célula)

Teste direcional, efeito em rampa, contagem de A como motor da conversão. **RR é o pico do efeito**, e o efeito médio efetivo ao longo da janela é menor. Margem de erro de 3 a 6 pontos percentuais por célula. Poder em %, liberação agregada por grupo e ciclo:

| Grupos | Meses | SED por grupo e mês | RR 1,5 | RR 2,0 | RR 3,0 |
|---|---|---|---|---|---|
| 20 | 12 | 8 | 18 | 37 | 69 |
| 40 | 12 | 8 | 33 | 58 | 91 |
| 60 | 12 | 8 | 36 | 77 | 99 |
| 100 | 12 | 8 | 50 | 90 | 100 |
| 20 | 18 | 8 | 29 | 53 | 87 |
| 40 | 18 | 8 | 50 | 82 | 100 |
| 60 | 18 | 8 | 55 | 92 | 100 |
| 40 | 24 | 8 | 55 | 91 | 100 |
| 40 | 12 | 16 | 37 | 70 | 97 |
| 40 | 18 | 16 | 46 | 82 | 99 |

Com a supressão por célula da versão 1 (8 SED por grupo e mês, 40 grupos, 12 meses): 10%, 21% e 33%. Ou seja, a liberação agregada é o que torna a análise possível.

**O que isso implica:**

1. O teste que se mantém calibrado em dados com persistência e causa comum custa poder. O piloto de 10 ou 20 grupos por 12 meses, aprovado antes, **não** detecta RR 1,5 nem RR 2,0 com poder aceitável. A referência de 91% da versão 1 não vale.
2. Para 80% de poder contra RR 2,0 (pico), a ordem de grandeza é de 40 grupos por 18 meses, ou 60 grupos por 12 meses, com 8 SED por grupo e mês. Para RR 1,5 não existe desenho viável abaixo de 100 grupos por 24 meses.
3. Grupos de vários clientes somam, desde que cada mês seja centrado dentro do cliente. Isso conversa com a exigência de pelo menos 3 clientes independentes.
4. O tamanho final fica para o fim da fase 1, com o volume e o kappa medidos.
5. **Não medido:** efeito em degrau (a auditoria obteve poder bem menor), erro do classificador, supressão parcial dentro do grupo liberado, e premissas de volume.

## 7. Critério de promoção (versão 2)

Níveis 0 a 4. **Nenhum critério pode ser alterado depois de olhar os dados**: o código, a estatística, a janela, o limiar de efeito e a data de corte são congelados por hash antes de qualquer leitura e registrados em ata do Founder.

**Porta de qualidade de dados** (para qualquer nível acima de 0): grupo com pelo menos 3 participantes distintos no ciclo; maturidade N2 ou superior; classificador estável quando repetido, com kappa de pelo menos 0,61 e validação por humanos em amostra; ausência de deriva da base.

| Nível | Exigência |
|---|---|
| 0, Hipótese | Está na matriz oficial. |
| 1, Sinal interno | Um cliente. Teste direcional primário com p abaixo de 5%, com a porta de qualidade aprovada, e controle negativo limpo. |
| 2, Candidato | O sinal se repete em período posterior congelado, ou em outro cliente, no mesmo sentido. |
| 3, Confirmado interno | Pelo menos 3 clientes independentes. Evidência combinada entre clientes (método de Stouffer sobre os testes unilaterais por cliente) com p abaixo de 5%. Nenhum cliente com mais de 50% do peso. Heterogeneidade entre clientes não significativa. Controle negativo limpo em cada cliente e no conjunto. Revisão por estatístico externo e ata do Founder. |
| 4, Exibível ao cliente | Decisão separada do proprietário, após 2 apurações semestrais consecutivas no nível 3, revisão ética e jurídica da linguagem e teste de compreensão com RH. A linguagem é sempre de associação. |

**Controle negativo reformulado:** o mesmo teste direcional aplicado aos 60 pares fora da matriz, em um teste único agrupado, com prazos atribuídos por rodízio pré especificado. O critério deixa de ser um limite de 5% sobre a taxa de pares e passa a ser o p valor do conjunto: se o controle rejeitar, o método é considerado inválido para aquele cliente. Quando o método é válido, o controle rejeita em 5% a 6% das vezes (600 simulações), ou seja, invalida por engano em cerca de 5%. Sob efeito real nos pares da matriz, o controle rejeita em 0%.

**Retirados:** Brier fora da amostra (passava só 7% a 11% das vezes sob RR 1,5), placebo de tempo, IEC de B como desfecho e "2 de 3 clientes no mesmo sentido" (passava em 50% das vezes sob a nula). O desfecho secundário de consolidação (B acima da linha de base do próprio grupo por 2 ciclos) é reportado, mas não é critério de promoção.

**Rebaixamento:** se a confirmação falhar em 2 apurações seguidas com dado novo, o nível cai para o 2.

**Ainda não calculado:** a probabilidade conjunta de um efeito real passar em todos os itens do nível 3 com o tamanho final. O tamanho e esse cálculo vão juntos para a segunda auditoria.

## 8. Fase 1: o que medir

1. Volume real: SED por grupo, mês, dívida e participante distinto; fração de SED com adjacência.
2. Concordância do classificador (kappa) contra uma amostra revisada por humanos, e o custo em poder.
3. Recalibração do estimador por simulação com o volume e a dispersão reais.
4. Definição e congelamento do efeito mínimo de interesse, do tamanho da fase 2 e do hash da análise.

## 9. Pendências abertas

| Item | Situação |
|---|---|
| Segunda rodada de auditoria externa sobre esta versão | A fazer |
| Intervalo de 95% do efeito subcobre em 2 a 4 pontos | Aberto |
| Calibração dos 3 testes por classe no estimador direcional | Aberto |
| Poder sob efeito em degrau e sob erro do classificador | Aberto |
| Matriz de adjacência conferida só em D1 a D4 e D9 (prazos imediata e curto) | Aberto |
| Revisão jurídica da liberação por grupo e ciclo | Aberto |
| Probabilidade conjunta de passar no nível 3 | Aberto |

## 10. Código

| Arquivo | O que faz |
|---|---|
| `lib/review/sql/schema.sql`, `grants.sql` | `group_cycle_release()`, só para o papel do motor |
| `lib/review/src/engine/adjacency.ts` | Rastreio de pares e emergência (uso interno) |
| `lib/review/sim/nucleo.mjs` | Gerador de dados (origem: núcleo do auditor externo; acrescentada a opção de causa comum) |
| `lib/review/sim/estimador.mjs` | Exposição, estimador direcional, teste, efeito, controle negativo, supressão pessimista |
| `lib/review/sim/fase2_fp.mjs`, `fase2_dir.mjs`, `fase2_dir2.mjs` | Calibração do erro tipo I |
| `lib/review/sim/fase2_poder.mjs` | Poder por tamanho de piloto e tipo de liberação |
| `lib/review/sim/fase2_controle.mjs` | Controle negativo |
| `docs/restart/sed-ingestion/fase2_*.jsonl`, `fase2_poder.txt` | Resultados brutos |
| `lib/review/sim/power.mjs`, `power_global.mjs`, `power2.mjs` | Versões anteriores, mantidas para histórico |
