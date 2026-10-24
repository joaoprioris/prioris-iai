# Método para validar a adjacência (versão 3)

Objetivo: decidir, com critério estatístico, quando a dívida A tende a ser seguida pela dívida adjacente B, antes de mostrar qualquer coisa ao cliente. O resultado fica interno ao motor até haver confirmação.

**O que o método pode afirmar:** "A precede B de forma consistente, em mais de um cliente". Ele não afirma "A causa B" nem "A se converte em B". Com contagens de SED apenas, não dá para separar conversão de duas dívidas que respondem ao mesmo evento com atrasos diferentes (seção 5). A palavra "conversão" fica restrita à hipótese de negócio.

**Situação:** a auditoria externa deu média 4,2 de 10 à versão 1 (`AUDITORIA_ESTATISTICA_EXTERNA.md`), 5,4 à versão 2 (rodada 2) e 5,9 à versão 3 (`AUDITORIA_ESTATISTICA_EXTERNA_RODADA3.md`), sempre com o mesmo veredito: "viável só para fase exploratória". Esta versão registra também as ressalvas da rodada 3, na seção 11. Vale como método da **fase exploratória** e nunca como base para exibir adjacência ao cliente.

**Nota sobre os arquivos de resultado:** `fase2_fp.jsonl` traz a coluna `primario_participacao`, mas roda o estimador só de defasagem (ingênuo), não o direcional. A simulação usa um número mínimo de SED por grupo e mês como proxy do número de participantes distintos (um SED por participante, o melhor caso).

## 1. Histórico das auditorias e situação dos achados

| Achado | Gravidade | Situação na versão 3 |
|---|---|---|
| Supressão por célula tirava o poder (R1) | Crítico | Resolvido: liberação por grupo e ciclo (seção 3) |
| Calibração só com dados independentes (R1) | Crítico | Resolvido para processos reversíveis; ver os limites na seção 5 |
| Sem estimador de efeito nem intervalo (R1) | Crítico | Estimador e intervalo existem; o efeito exige calibração por simulação (seção 4) |
| Critérios de promoção quebrados (R1) | Alto | Reescritos (seção 7) |
| Circularidade do desfecho (R1) | Alto | IEC de B retirado; exposição pela participação de A |
| Simetria quebra com transitório inicial, ciclo de grupo e causa comum com atraso: 9% a 58% de falso positivo (R2) | Alto | Transitório: mitigado pelo descarte inicial de 3 meses. Ciclo e atraso: **não resolvidos**, limite de identificação (seção 5) |
| Nível 3 sem efeito mínimo, sem definição de peso, regra de 50% impossível (R2) | Alto | Reescrito: peso igual por cliente, regra de 50% retirada, efeito mínimo definido na fase 1 (seção 7) |
| Poder é um teto: degrau 41%, efeito rápido 38% (R2) | Alto | Medido de novo: o teste é cego a efeito constante e quase cego a efeito rápido (seção 6) |
| Privacidade da liberação por grupo (R2) | Alto | Piso de 5, dominância de 50% e papel próprio (seção 3). Revisão jurídica aberta |
| Controle negativo cego sob efeito real e invalida método por matriz incompleta (R2) | Médio | Reformulado: unilateral, 1%, e o resultado não "invalida" o método (seção 7) |
| Divergências texto versus números (R2) | Médio | Corrigidas |
| Matriz de adjacência conferida só em parte contra o Mestre | Médio | Aberto |

## 2. Decisões do proprietário

1. **Falso positivo aceito:** 5%.
2. **Prazos da matriz:** imediata = 0 a 1 mês; curto = 2 a 3; médio = 4 a 6.
3. **Piloto em duas fases, sem tamanho fixo agora** (aprovado em 23/10/2026):
   * **Fase 1, medição, 2 meses.** Mede o volume real de SED por grupo, mês, dívida e participante distinto. Mede a concordância do classificador com amostra revisada por humanos. Calibra o estimador com o volume real. Nenhum resultado de adjacência é lido.
   * **Fase 2, exploratória.** Roda o método e não promove nada acima do nível 1. O tamanho final é definido ao fim da fase 1.
   * **Descarte inicial:** os primeiros 3 meses do programa (a fase 1 mais o primeiro mês da fase 2) não entram no teste, porque o período inicial tem efeitos de novidade (seção 5). Os dados são coletados e guardados.
4. **Supressão (aprovada em 23/10/2026):** estatística agregada por grupo e ciclo. **Em 24/10/2026, após a segunda auditoria:** piso de 5 participantes distintos, regra de dominância e papel de banco próprio (seção 3).
5. **Critério de promoção:** direção aprovada em 23/10/2026; texto atualizado na seção 7 e a validar na terceira auditoria.

## 3. Liberação de dados para a análise

A função `prioris_review.group_cycle_release()` entrega a contagem de SED por dívida principal, por grupo e ciclo encerrado.

**Supressão do grupo no ciclo, antes de liberar qualquer contagem:**
1. no mínimo **5 participantes distintos** no total do grupo;
2. **dominância:** nenhum participante pode responder por mais de 50% dos SED do grupo no ciclo.

Dentro do grupo liberado, as contagens por dívida saem completas.

**Acesso:**
* Papel de banco próprio, `review_engine`, que também executa `adjacency_release()`. O papel que serve o painel (`review_report`) e o de ingestão são recusados nas duas funções.
* Não vaza entre clientes (isolamento por `app.tenant`).
* `adjacency_release()` continua com supressão por célula de 3 participantes (decisão C) e serve só à análise secundária.

**Regras de aplicação que o banco não impõe:** o resultado por grupo nunca sai do motor; só saem estatísticas agregadas entre grupos, e apenas com no mínimo 10 grupos por cliente. O acesso deve ter registro de consulta. Isso é política e precisa de revisão jurídica antes da fase 2.

**Testes:** 52, nenhum falho, com PostgreSQL local. Cobrem grupo com 5 participantes (liberado, 1 SED por participante), grupo com 4 (suprimido pelo piso), grupo com 5 em que um participante passa de 50% (suprimido pela dominância), isolamento entre clientes e recusa dos papéis de ingestão e de painel.

**Risco que permanece (segunda auditoria):** com 3 a 5 participantes ainda é possível inferir atribuição individual a partir do padrão de contagens, e a diferença entre dois ciclos revela quem entrou ou saiu. O piso de 5 e a dominância reduzem, não eliminam. Ruído por contagem foi medido e custa poder demais (de 79% para 10% a 28%), então a proteção principal é restringir o canal.

## 4. Desenho do teste

**Unidade de réplica:** o grupo. Meses e participantes dentro do grupo não são tratados como independentes.

**Exposição primária:** para cada par da matriz (A, B), a participação de A como dívida principal nos meses da janela do prazo, de 1 mês até 6 meses atrás, como média da participação de A entre os SED de cada mês. Não depende do rótulo de adjacência do classificador.

**Desfecho:** participação de B entre os SED do grupo no mês.

**Remoção de efeitos comuns:** exposição e desfecho são centrados por mês entre grupos do mesmo cliente (remove tendência, sazonalidade e choque do cliente).

**Estimador direcional (primário):** para cada grupo, escore de defasagem (exposição passada) menos escore de avanço (a mesma exposição com os meses seguintes). Se A e B variam juntas por causa comum persistente e reversível, os dois escores ficam iguais e a diferença se anula.

**Descarte inicial:** os 3 primeiros meses do programa não entram no teste, nem como desfecho nem como fonte de exposição.

**Teste:** t de Student unilateral sobre os escores por grupo (G menos 1 graus de liberdade), nível de 5%.

**Efeito:** `beta` = soma dos escores sobre a soma de `e²·N`, a variação da participação de B por unidade de participação de A na janela. Duas ressalvas medidas:
* O beta estimado é só **13% a 22% do efeito aditivo injetado** (`fase3_atenuacao.jsonl`), e a relação não é linear. Ele não é um RR nem uma variação percentual diretamente interpretável.
* Por isso o efeito mínimo de interesse é definido **na escala do gerador**, na fase 1: o proprietário escolhe o aumento aditivo da chance de B por 10 pontos percentuais de A que considera relevante, e a simulação com o volume real traduz isso no beta esperado. O mapeamento fica congelado no hash.
* A função `efeitoRelativo` (`estimador2.mjs`) devolve o aumento relativo de B para +10 pontos percentuais de A, útil para descrição, não para decisão.

**Prazo:** o teste valida "A precede B em até 6 meses". Não valida o prazo de cada classe (janelas sobrepostas, poder baixo).

**Desfechos retirados:** IEC de B (circular por fórmula) e placebo de tempo.

**Variantes testadas e descartadas** (resultados negativos, mantidos para não repetir o erro):

| Variante | Resultado |
|---|---|
| Remover tendência linear por grupo | Resolve o transitório (3,5% a 4,5%), mas derruba o poder: 40 grupos por 12 meses, RR 2, de 58% para 14% |
| Janela única de 1 a 6 meses | Piora o falso positivo em ciclo de grupo e causa comum com atraso (de 10% a 16% na média) |
| Referência pelos pares de controle (comparar a matriz com subconjuntos de controle) | Descalibrada: 13% a 28% de falso positivo, porque matriz e controles não são trocáveis nem sob a nula |

## 5. Calibração do erro tipo I

**Reversível e estacionário (a maior parte dos cenários):** o direcional ficou entre 3,9% e 7,5% (nominal 5%), em dezenas de cenários somando as duas rodadas de auditoria, inclusive tendência, sazonalidade, autocorrelação positiva e negativa, causa comum com sinais opostos, poucos grupos (6 a 10), poucos meses (6 a 9), volume de 1 a 2 SED. Ele é levemente liberal, de 0,5 a 1 ponto. O teste só de defasagem (ingênuo) falha de 10% a 49% sob causa comum persistente, por isso o primário é o direcional.

**Efeitos de início de programa (20 grupos, 18 meses de teste, 800 simulações):**

| Cenário | Sem descarte | Descarte de 3 meses |
|---|---|---|
| Base (independente) | 5,3% | 4,9% |
| Transitório inicial compartilhado, decai em 2 meses | 9,1% | 5,8% |
| Transitório inicial forte, decai em 4 meses | 18,1% | 9,0% |
| Autocorrelação começando em zero | 5,6% | 4,9% |
| Tendência de grupo com sinais opostos | 5,3% | 4,3% |

**Não resolvidos (processos com direção no tempo):**

| Cenário (12 mundos sorteados) | Falso positivo médio | Máximo |
|---|---|---|
| Ciclo de grupo de período 6 com fase por dívida | 14,9% | 90% |
| Ciclo de grupo de período 4 com fase por dívida | 8,4% | 33% |
| Causa comum com atraso diferente por dívida | 6,6% | 14% |

Se A e B oscilam com o mesmo ritmo e fases diferentes, A "precede" B pelo calendário, sem conversão. Isso é um limite de identificação, não um problema de calibração, e nenhum ajuste de estimador resolveu (seção 4). A mitigação é de desenho: o nível 3 exige **corroboração por canal independente**, a pesquisa silenciosa de B (seção 7). Não sei com que frequência esses processos ocorrem; os cenários são hipóteses do auditor e minhas.

**Limites do intervalo de confiança:** o intervalo de 95% do efeito cobre zero em 91% a 93% dos casos sob a nula (nominal 95%). O critério usa o p valor.

## 6. Poder

Teste direcional com descarte de 3 meses, piso proxy de 5 SED por grupo e mês, liberação agregada, 250 simulações por célula (margem de 3 a 6 pontos percentuais). Poder em %, 8 SED por grupo e mês, meses de teste depois do descarte. `rampa` = efeito que cresce com a exposição acumulada; **RR é o pico do efeito**, e o efeito médio efetivo é menor.

| Grupos | Meses | Rampa RR 2,0 | Rampa RR 3,0 | Aditivo (beta 0,10) |
|---|---|---|---|---|
| 20 | 12 | 34 | 61 | 30 |
| 40 | 12 | 54 | 84 | 46 |
| 60 | 12 | 64 | 95 | 56 |
| 100 | 12 | 88 | 99 | 80 |
| 40 | 18 | 74 | 97 | 64 |
| 60 | 18 | 88 | 99 | 74 |
| 100 | 18 | 96 | 100 | 93 |
| 40 | 24 | 87 | 99 | 77 |
| 60 | 24 | 96 | 100 | 93 |

**O que o teste não enxerga:**
* **Efeito constante em todo o programa** (degrau que liga em todos os grupos no mesmo momento): poder de 4% a 12% em qualquer tamanho testado, ou seja, o nível do acaso. Sem variação de exposição entre grupos e meses não há o que medir.
* **Efeito rápido** (só nos lags 1 e 2): 6% a 38%, mesmo com 100 grupos.
* Com 4 SED por grupo e mês, o poder cai muito (24% a 92% para RR 3,0, conforme grupos e meses).

Implicações:
1. Para 80% de poder contra RR 2,0 em rampa: 60 grupos por 18 meses de teste, ou 40 grupos por 24 meses. Para RR 3,0: 40 grupos por 12 meses.
2. Grupos de vários clientes somam, com cada mês centrado dentro do cliente.
3. O poder nem sempre cresce com o volume neste gerador, porque o efeito simulado satura pela contagem absoluta de A. Isso é premissa do gerador.
4. O tamanho final fica para o fim da fase 1.

## 7. Critério de promoção (versão 3)

Níveis 0 a 4. **Nenhum critério pode ser alterado depois de olhar os dados.** Código, estatística, janela, descarte inicial, efeito mínimo e cliente de referência são congelados por hash antes de qualquer leitura e registrados em ata do Founder.

**Porta de qualidade de dados** (qualquer nível acima de 0): grupo liberado conforme a seção 3; maturidade N2 ou superior; classificador estável, kappa de pelo menos 0,61, validado por humanos em amostra (kappa 0,61 custa poder, e o tamanho final usa o kappa medido); ausência de deriva da base.

| Nível | Exigência |
|---|---|
| 0, Hipótese | Está na matriz oficial. |
| 1, Sinal interno | **Um cliente de referência, escolhido antes dos dados.** Teste direcional primário com p abaixo de 5% e controle negativo limpo. Não se aceita "o primeiro dos clientes que passar": a livre escolha dá 16% a 18% de falso positivo. |
| 2, Candidato | O sinal se repete **com p abaixo de 5%** em período posterior congelado do mesmo cliente, ou em outro cliente. "Mesmo sentido" sem significância não basta. |
| 3, Precedência confirmada (interno) | Pelo menos 3 clientes independentes. Evidência combinada de Stouffer **com peso igual por cliente**, p abaixo de 5%. Sinal positivo nos 3 clientes. Controle negativo limpo no conjunto. **Estimativa agrupada do efeito igual ou acima do efeito mínimo** definido na fase 1. **Corroboração pré especificada pelo canal independente** (pesquisa silenciosa de B), com resultado reportado. Revisão por estatístico externo e ata do Founder. |
| 4, Exibível ao cliente | Decisão separada do proprietário, após 2 apurações semestrais consecutivas no nível 3, **com a corroboração pela pesquisa silenciosa como exigência** (não só reportada), revisão ética e jurídica da linguagem e teste de compreensão com RH. A linguagem é de associação e precedência. |

**Controle negativo:** o mesmo teste direcional aplicado aos 60 pares fora da matriz, em teste único agrupado, **unilateral superior, a 1%**. Só um controle positivo indica precedência espúria. Sob efeito real o controle vai para valores negativos (efeito composicional), por isso o lado inferior é ignorado. Se o controle rejeitar, não se promove e investiga-se: a causa pode ser precedência estrutural, ou conversões fora da matriz (matriz incompleta, o que é informação, não invalidação). Sob a nula o controle passa 98% a 99% das vezes.

**Retirados:** regra de 50% do peso (era impossível e indefinida), teste de heterogeneidade (poder baixo com 3 clientes, não prova consistência), Brier, placebo de tempo, IEC de B como desfecho, "2 de 3 clientes no mesmo sentido". Uma retirada de cada cliente mantendo p abaixo de 10% foi testada e descartada: custa de 15 a 20 pontos de poder e quase não reduz o falso positivo.

**Probabilidade de passar o nível 3 estatístico** (3 clientes, regras acima, sem revisão externa e sem corroboração; 400 simulações; `fase3_niveis.jsonl`):

| Desenho | Sem efeito | RR 2,0 rampa | RR 3,0 rampa | Efeito em 2 de 3 clientes (RR 3,0) | RR 2,0 constante |
|---|---|---|---|---|---|
| 40 grupos, 18 meses (14/13/13) | 3,8% | 69% | 94% | 47% | 7% |
| 60 grupos, 12 meses (20/20/20) | 3,0% | 59% | 86% | 45% | 6% |
| 60 grupos, 12 meses (36/14/10) | 3,0% | 54% | 83% | 39% | 7% |

Chance de nível 1 no cliente de referência: 5% a 6,5% sob a nula, 33% a 48% sob RR 2,0 em rampa.

**Rebaixamento:** se a confirmação falhar em 2 apurações seguidas com dado novo, o nível cai para o 2.

## 8. Fase 1: o que medir

1. Volume real: SED por grupo, mês, dívida e participante distinto; fração de SED com adjacência; participação de cada participante (dominância).
2. Concordância do classificador (kappa) contra amostra revisada por humanos, e o custo em poder.
3. Recalibração do estimador por simulação com o volume e a dispersão reais, e tradução do efeito mínimo escolhido pelo proprietário em beta esperado.
4. Congelamento do hash: código, estatística, janela, descarte, efeito mínimo, cliente de referência e tamanho da fase 2.

## 9. Pendências abertas

| Item | Situação |
|---|---|
| Terceira rodada de auditoria externa | A fazer |
| Precedência por ciclo de grupo ou causa comum com atraso (falso positivo de 7% a 90% conforme o mundo) | **Sem solução estatística**; mitigada por desenho (corroboração independente) |
| Corroboração pela pesquisa silenciosa: estimador, calibração e poder | Não desenhado nem simulado |
| Intervalo de 95% do efeito subcobre em 2 a 4 pontos | Aberto |
| Calibração dos 3 testes por classe de prazo no direcional | Aberto |
| Efeito constante e efeito rápido não são detectáveis por este desenho | Limite declarado; avaliar outro desenho |
| Matriz de adjacência conferida só em D1 a D4 e D9 | Aberto |
| Revisão jurídica da liberação por grupo e ciclo | Aberto |
| Regra de aplicação "mínimo de 10 grupos por cliente" e registro de consulta | Não imposta pelo banco |
| Probabilidade conjunta do nível 3 com os itens não estatísticos | Aberto |

## 10. Código

| Arquivo | O que faz |
|---|---|
| `lib/review/sql/schema.sql`, `grants.sql`, `roles.sql` | `group_cycle_release()` (piso 5, dominância 50%), papel `review_engine` |
| `lib/review/src/engine/adjacency.ts` | Rastreio de pares e emergência (uso interno) |
| `lib/review/sim/nucleo.mjs`, `gerador2.mjs` | Geradores de dados (origem: núcleo e rodada 2 do auditor externo; acrescentada a causa comum persistente) |
| `lib/review/sim/estimador.mjs` | Estimador da versão 2 |
| `lib/review/sim/estimador2.mjs` | Estimador final: descarte inicial, tendência por grupo (descartada), controle, efeito |
| `lib/review/sim/fase2_*.mjs` | Calibração e poder da versão 2 |
| `lib/review/sim/fase3_robustez.mjs`, `fase3_burn.mjs` | Transitório, ciclo de grupo, causa comum com atraso, descarte inicial |
| `lib/review/sim/fase3_poder.mjs`, `fase3_poder_final.mjs` | Poder |
| `lib/review/sim/fase3_ref.mjs` | Referência por pares de controle (descartada) |
| `lib/review/sim/fase3_niveis.mjs` | Probabilidade de promoção por nível |
| `lib/review/sim/fase3_atenuacao.mjs` | Relação entre beta estimado e efeito injetado |
| `docs/restart/sed-ingestion/fase2_*`, `fase3_*` | Resultados brutos |
| `lib/review/sim/power.mjs`, `power_global.mjs`, `power2.mjs` | Versões anteriores, para histórico |

## 11. Ressalvas da rodada 3 da auditoria (24/10/2026)

O veredito da rodada 3 foi o mesmo: viável como instrumento exploratório interno, não para confirmação. Os pontos abaixo corrigem ou qualificam o texto acima.

1. **O descarte de 3 meses tem custo não declarado antes.** Ele resolve o transitório rápido (7,5% para 5,7%), mas não o lento (tau de 6 a 10 meses: 9,9% a 15,7%) nem o início escalonado dos grupos (9% a 11%). E custa poder: com 15 meses de calendário, 40 grupos e RR 2,0, o poder é 65% usando todos os meses e 48% com descarte. A decisão de descartar deve ser revista na fase 1, com o padrão real de início.
2. **Efeito mínimo fora da tabela de probabilidade.** As probabilidades da seção 7 não aplicam o corte em beta. Com o corte, o nível 3 cai de 64% para 42% no cenário medido. Tratar a tabela da seção 7 como teto. O beta é 7% a 20% do efeito injetado, côncavo e com desvio de cerca de 40%, então traduzir o efeito mínimo em beta exige o volume real.
3. **Ciclo comum a vários clientes.** Três clientes com o mesmo calendário "confirmam" o viés em 14,1% das vezes. Replicar em clientes não prova independência do ciclo.
4. **A corroboração herda o viés.** Com a pesquisa refletindo o estado latente do ciclo, o falso positivo conjunto é 11,7% contra 14,1% só no primário. Uma pesquisa independente do ciclo daria 1,0%, mas corroboraria o efeito real em só 2,2%. A corroboração, como está, não é proteção comprovada; vale como informação adicional, e uma variação exógena de A seria melhor.
5. **O controle negativo não protege contra falso positivo.** Ele tem correlação de menos 0,55 a menos 0,60 com o primário e não barrou nenhum falso positivo nos testes. Só dispara com efeito fora da matriz (3% a 7%). Serve para detectar matriz incompleta, não como defesa.
6. **Volume liberado.** O proxy de 5 SED por grupo e mês ignora a dominância e superestima os dados liberados. Entre 0% e 40% de meses perdidos há cerca de 40 pontos de poder em jogo (81% contra 59% com 20% perdidos). Tratar o mês suprimido como ausente, e não como zero, melhora o poder em 3 a 10 pontos sem custo no falso positivo: adotar na fase 2.
7. **Privacidade.** Sobra o conjunto de 5 pessoas com contagens 1 ou 2. O banco não impõe a agregação entre grupos nem o mínimo de 10 grupos por cliente. O teste não cobre o limite exato de 50%, o privilégio mínimo do papel nem o isolamento com dado nos dois lados.
8. **Divergência de números.** O cenário "autocorrelação começando em zero" aparece com 4,9% e com 8,8% em arquivos diferentes (tamanhos de amostra e configurações diferentes). Usar a faixa de 4,9% a 8,8%. A afirmação de que a janela cheia piora o ciclo vale só para o período 4 e para o atraso; no período 6 ela melhora.
9. **O poder de 41% do degrau na rodada 2 era artefato do início do programa:** 46% sem descarte, 10% com descarte de 3.
10. **Condições para o nível 3, segundo a auditoria:** diagnóstico de ausência de ciclo de grupo, atraso comum e transitório lento (ou variação exógena de A); poder recalculado com o volume real liberado pela regra do banco; efeito mínimo dentro da tabela; corroboração insensível ao ciclo; mês suprimido como ausente; agregação mínima de 10 grupos imposta no banco.
