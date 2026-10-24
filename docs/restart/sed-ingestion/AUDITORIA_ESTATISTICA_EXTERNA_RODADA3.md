# Auditoria estatística externa, rodada 3

Alvo: versão 3 do método (commit 734772d): `METODO_ADJACENCIA.md`, `estimador2.mjs`, `gerador2.mjs`, `fase3_*.mjs` e `fase3_*` (resultados), `group_cycle_release()` com piso de 5 e dominância em `schema.sql`, `roles.sql`, `grants.sql`, o teste em `database.test.ts`. Mesma independência das rodadas anteriores. Nada do repositório foi alterado além deste relatório e da pasta `auditoria_externa/rodada3/`. Sem commit, rede, API paga ou Drive.

Como li: escrevi um escorer próprio (`r3_lib.mjs`, função `esc3`) e um gerador próprio estendido (`r3_gen.mjs`, com início escalonado de grupos, mudança de regime e retorno das probabilidades latentes para a pesquisa silenciosa). O escorer coincide exatamente com `escoresV3` de `estimador2.mjs` com descarte de 3 meses (diferença relativa máxima 0, `r3_checa.mjs`). Os números "meus" vêm desse código. Pontos como "mês suprimido tratado como ausente", descarte só do desfecho e por grupo são variantes minhas. IC95 de Wilson entre colchetes. O SQL e o teste foram lidos, não executados (não há servidor PostgreSQL aqui); aceito a informação de que os 52 testes passam no seu ambiente.

## 1. Resumo

1. O método ficou mais honesto e mais restrito: afirma só "A precede B", admite que ciclo de grupo e causa comum com atraso não têm solução estatística, retira as regras impossíveis, tem piso de 5 e dominância, e a tabela de poder reproduz (27 de 27 células idênticas ao arquivo, e meu código independente concorda dentro do erro).
2. O descarte inicial de 3 meses **resolve só o transitório rápido** (decaimento de 2 meses: 7,5% para 5,7%). Com decaimento de 4 a 10 meses o falso positivo continua em 8% a 16%; com início escalonado dos grupos o descarte de calendário não ajuda (9% a 11%, igual ou pior que sem descarte). Mudança de regime no meio do período é inofensiva (conservadora).
3. O descarte tem um **custo em poder que o documento não declara**: com 15 meses de calendário, 40 grupos e RR 2, o poder cai de 65% (usar os 15 meses) para 48% (descartar 3). Pior que ter coletado só 12 meses sem descarte (58%).
4. A corroboração por pesquisa silenciosa **não reduz** o falso positivo quando a pesquisa oscila com o mesmo ciclo. Se a pesquisa reflete o estado latente (cenário mais natural), o falso positivo conjunto em ciclo de período 6 cai só de 14,1% para 11,7%. Se a pesquisa for independente do ciclo, cai a 1,0%, mas também perde a capacidade de corroborar o efeito real (2,2%). Além disso, no nível 3 a corroboração é só "reportada", não exigida.
5. O controle negativo unilateral 1% **não protege contra nada** do que o primário erra: ele é estruturalmente anticorrelacionado com o primário (correlação de t igual a menos 0,55 sob a nula, menos 0,60 em mundos de ciclo) porque 16 dos 60 pares de controle são os recíprocos de pares da matriz. Em nenhum dos mundos simulados o controle barrou um único falso positivo do primário. Ele dispara quando há conversão fora da matriz.
6. A regra do efeito mínimo na escala do gerador **não é implementável de modo confiável**: a razão beta estimado sobre efeito injetado varia de 0,07 a 0,20 conforme o prazo do efeito, é côncava no tamanho do efeito (0,20 em 0,05; 0,11 em 0,40), e o desvio entre simulações (0,0075) é 40% do beta de um efeito de 0,10.
7. A privacidade melhorou (piso 5, dominância, papel próprio), mas o proxy da simulação (5 SED) superestima muito a quantidade de dados liberada: com participantes de atividade desigual, grupos de 5 a 12 pessoas liberam 0% a 10% dos grupos e meses com 8 SED por mês. O poder da seção 6 pressupõe um volume que a regra do banco não entrega.
8. Veredito: **VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO** (seção 11). Média das notas: 4,2, 5,4, 5,9.

## 2. Pergunta A: o descarte inicial de 3 meses

20 grupos, 18 meses de teste mais 3 de descarte (21 gerados), 8 SED por grupo e mês, 1500 simulações por célula (`resultados/burn_r3.jsonl`). Rejeição sob a nula, %:

| Cenário nulo | Sem descarte | Descarte 3 (doc) | Descarte 3 do desfecho, exposição livre | Descarte 6 | Descarte 3 com janela cheia dos dois lados |
|---|---|---|---|---|---|
| Base | 5,0 | 4,1 | 4,2 | 4,8 | 5,7 |
| Transitório, decai em 2 meses, dp 1 | 7,5 | 5,7 | 8,1 | 6,3 | 5,3 |
| Transitório, decai em 4 meses, dp 1,5 | 18,4 | 7,8 | 28,9 | 7,0 | 12,5 |
| **Transitório, decai em 6 meses, dp 1** | 13,3 | **9,9** | 21,7 | 7,3 | 13,5 |
| **Transitório, decai em 6 meses, dp 1,5** | 20,8 | **11,6** | 40,0 | 8,7 | 22,7 |
| **Transitório, decai em 10 meses, dp 1,5** | 23,6 | **15,7** | 51,5 | 11,3 | 34,4 |
| **Início escalonado dos grupos (entrada em 0 a 6), transitório de 2 meses** | 7,9 | **8,9** | 8,5 | 7,3 | 9,7 |
| **Escalonado, transitório de 4 meses, dp 1,5** | 7,5 | **10,6** | 9,8 | 10,0 | 15,7 |
| **Escalonado, transitório de 6 meses** | 8,1 | **9,3** | 9,8 | 9,7 | 12,7 |
| Escalonado sem transitório | 6,1 | 5,4 | 5,7 | 6,2 | 5,1 |
| Mudança de regime no meio, dp 0,5 por bloco, por grupo | 3,3 | 3,2 | 3,6 | 3,0 | 1,5 |
| Mudança de regime, dp 0,8 | 2,2 | 1,9 | 2,1 | 1,9 | 0,5 |
| Mudança de regime, dp 1,2 | 0,8 | 0,9 | 0,8 | 0,8 | 0,1 |

Descarte por grupo (3 meses a partir da entrada de cada grupo), início escalonado, `escalonado_r3.jsonl`: tau 4 dp 1,5: 10,3% (contra 9,8% do calendário); tau 6: 9,0% (contra 9,6%). Descartar 6 meses por grupo: 6,9% e 7,1%. Em autocorrelação começando em zero (G 20, 21 meses): 6,9% sem descarte, 5,8% com 3 e com 6.

Leitura:

* **Resolve** o transitório rápido (dois meses). **Não resolve** o lento: 9,9% a 15,7%. O documento chama de "mitigado", correto, mas a tabela do documento só mostra decaimento de 2 e de 4 meses. O decaimento de 4 meses forte fica em 7,8% a 9,0% nos meus números e nos do documento; o de 6 a 10 meses não está lá.
* **Início escalonado** (grupos entram no programa em meses diferentes) é o caso realista para um piloto com muitos grupos e o descarte de calendário não o neutraliza (9% a 11%). Descartar a partir da entrada de cada grupo também não basta para transitórios de 4 a 6 meses; seria preciso 6 ou mais meses por grupo.
* **Mudança de regime no meio** não infla: o teste fica conservador (0,8% a 3,3%). Não é um problema de erro tipo I, mas reduz o poder se o regime existir de fato.
* **Viés ou perda de poder não declarados**: sim. Com 15 meses de calendário, G 40, rampa (gerador do documento), piso 5 (500 simulações, `poder_custo_r3.txt`):

| | RR pico 2 | RR pico 3 |
|---|---|---|
| Usar os 15 meses, sem descarte | 64,6% [60,3; 68,7] | 95,2% |
| Descarte 3, o resto é desfecho e exposição (doc) | **48,0%** [43,7; 52,4] | 83,6% |
| Descarte 3 só do desfecho, exposição livre | 69,0% | 96,8% |
| 12 meses de calendário, sem descarte | 57,6% | 87,6% |

  Ou seja: o descarte de 3 meses custa 17 pontos de poder em RR 2 (12 pontos em RR 3), e coletar 3 meses a mais não compensa; ficar com 12 meses sem descarte rende mais que 15 com descarte. A tabela da seção 6 usa "meses de teste depois do descarte", então o piloto "40 grupos por 12 meses" custa 15 meses de calendário. O documento diz isso na seção 2, mas não diz o custo de poder do descarte de exposição.
* A variante "descartar só o desfecho e deixar os meses iniciais como fonte de exposição" recupera o poder mas **piora** o falso positivo sob transitório (28,9% a 51,5%). Não serve.
* Observação: o poder que o documento atribuiu ao "degrau" na rodada 2 (41%) era um artefato do início do programa. Com efeito que liga no mês 1 em todos os grupos, a única variação é o próprio início. Medi (`degrau_r3.jsonl`): descarte 0 dá 45,6%; descarte 1 dá 13,8%; 3 dá 10,4%. Portanto o v2 "detectava" o começo do programa como se fosse conversão, o que confirma a necessidade de descartar, e é um achado que o documento não registra.

## 3. Pergunta B: ciclo de grupo e causa comum com atraso

**Concordo que não há solução só com contagens.** O estimador direcional mede a assimetria entre a covariância cruzada de A e B nos lags positivos e negativos. Ciclo de grupo com fase por dívida e causa comum com atrasos distintos produzem essa assimetria sem nenhuma conversão. O que o estimador vê é idêntico ao que veria sob conversão. Testei os desenhos possíveis nas rodadas 2 e 3: janela cheia, tendência por grupo, referência por controles, estimador só de avanço. Todos falham ou matam o poder. Também não há ganho em usar o par recíproco (B para A): o escore direcional é antissimétrico (S(A para B) igual a menos S(B para A)), então o recíproco não traz informação adicional.

**A corroboração por pesquisa silenciosa faz sentido estatístico?** Só se a pesquisa for sensível ao efeito e insensível ao confundidor. Simulei a versão mínima (`r3_corrob.mjs`, 20 grupos, 18 meses de teste mais 3 de descarte, 8 SED, 12 mundos por ciclo, 500 simulações por mundo): a pesquisa é uma medida contínua por grupo, mês e dívida, igual a kappa vezes o logaritmo da probabilidade latente de a dívida ser principal, mais ruído de dp 0,5. O mesmo estimador direcional é aplicado à pesquisa de B, exposição com A pelos SED, teste a 5%.

| Cenário nulo ou real | kappa | Primário rejeita | Pesquisa rejeita | Ambos rejeitam |
|---|---|---|---|---|
| Nula base | 1,0 | 5,2% | 5,8% | 0,6% |
| **Ciclo de grupo, período 6 (12 mundos)** | 1,0 | 14,1% | 21,7% | **11,7%** [10,9; 12,6] |
| Ciclo de grupo, período 6 | 0,5 | 14,1% | 15,0% | 9,1% |
| Ciclo de grupo, período 6 | 0,0 | 14,1% | 5,7% | 1,0% |
| Ciclo de grupo, período 4 (12 mundos) | 1,0 | 9,7% | 18,1% | 4,9% |
| Ciclo de grupo, período 4 | 0,5 | 9,7% | 9,6% | 2,1% |
| Causa comum com atraso (12 mundos) | 1,0 | 7,7% | 9,0% | 1,9% |
| Causa comum com atraso | 0,5 | 7,7% | 7,5% | 1,1% |
| **Efeito real aditivo 0,10, 40 grupos** | 1,0 | 47,6% | 99,0% | **47,0%** |
| Efeito real | 0,5 | 47,6% | 64,4% | 31,8% |
| Efeito real | 0,0 | 47,6% | 5,4% | 2,2% |

Resposta: se a pesquisa mede o mesmo estado latente que os SED (kappa 1), ela **herda o viés** do ciclo: o falso positivo conjunto cai pouco no ciclo de período 6 (14,1% para 11,7%) e mais no de período 4 e no atraso (para 4,9% e 1,9%, porque ali o ruído da pesquisa independente de dp 0,5 pesa mais). Se a pesquisa for independente do ciclo (kappa 0), o falso positivo conjunto cai a 1% mas o poder para corroborar o efeito verdadeiro cai a 2%. O compromisso é inevitável: a corroboração só ajuda se o canal for causalmente independente do confundidor e sensível à conversão ao mesmo tempo, o que nenhuma contagem garante. Em RH, o mesmo estressor (reorganização, ciclo orçamentário) afeta os SED e as respostas da pesquisa; o caso kappa 1 é o mais plausível.

Duas fragilidades de desenho adicionais: (1) no nível 3 a corroboração é "reportada", não condiciona a promoção (seção 7, linha do nível 3), então não reduz nada no nível 3; só o nível 4 a exige; (2) a pesquisa, como desfecho contínuo por grupo e ciclo, exige piso de 3 respondentes (a regra de `survey_release()`), com poder que ninguém calculou.

Desenho alternativo que reduziria o falso positivo nesses mundos: variação **exógena** de A (por exemplo, entrada escalonada de uma intervenção em lideranças, sorteada), em vez de lead lag observacional. Isso fica fora do escopo de contagens, mas é a única saída que conheço.

## 4. Pergunta C: níveis de promoção

Reproduzi a tabela da seção 7 com meu escorer: descarte 3, peso igual por cliente (Z igual à soma dos z dividida por raiz de 3), sinal positivo nos 3, controle unilateral 1% (Stouffer dos z de controle), 400 simulações, gerador do documento (`niveis_r3.jsonl`).

| Desenho | Nenhum efeito | RR 2 rampa | RR 3 rampa | Efeito em 2 de 3 (RR 3) | Doc: nenhum, RR2, RR3, 2 de 3 |
|---|---|---|---|---|---|
| 40 grupos, 18 meses, 14/13/13 | 3,5% | 64% | 94% | 49% | 3,8, 69, 94, 47 |
| 60 grupos, 12 meses, 20/20/20 | 5,3% | 60% | 88% | 40% | 3,0, 59, 86, 45 |
| 60 grupos, 12 meses, 36/14/10 | 5,0% | 54% | 82% | 44% | 3,0, 54, 83, 39 |
| 60 grupos, 12 meses, 45/10/5 (adicional meu) | 4,0% | 43% | 66% | 42% | |

Concorda dentro do erro Monte Carlo. Nível 1 no cliente de referência: 4,8% a 7,0% sob a nula (doc 5% a 6,5%); 30% a 54% sob RR 2 rampa (doc 33% a 48%). Livre escolha: 16% a 18% sob a nula, como o documento diz. Ele resolve: com o cliente pré especificado, a taxa é a do teste (5%). Resta uma brecha: a escolha do cliente de referência é feita antes dos dados mas depois de ver o volume na fase 1; se a escolha depender do volume e de resultados da fase 1 a escolha pode ser pouco aleatória. O hash congelado impede mudança posterior, não a escolha.

**A retirada da regra de 50% e do teste de heterogeneidade se sustenta?**

* A regra de 50% era impossível e indefinida; retirar é correto. Mas o peso igual por cliente tem custo: com clientes muito desiguais (45/10/5), o nível 3 cai de 60% para 43% sob RR 2 porque o cliente de 5 grupos pesa tanto quanto o de 45.
* Sem heterogeneidade, o nível 3 passa por efeito em **um só cliente**: com efeito RR 3 (ou 5) apenas em 1 de 3 clientes, o nível 3 estatístico passa em 16% a 24% (40×18: 20% e 24%; 60×12: 16,5%, 20,5%, 21%, 24%, 21,5%, 22,8%). A regra de sinal positivo nos 3 clientes (25% de chance sob a nula para clientes sem efeito) é a única exigência de consistência, e é fraca. "Replicação em 3 clientes" não é o que o nível 3 mede; mede evidência combinada.
* Sob **viés estrutural comum** (ciclo de grupo com as mesmas fases por dívida nos 3 clientes) o nível 3 estatístico passa em **14,1%** [12,5; 15,7] (fases independentes por cliente: 10,9%; só um cliente com ciclo: 5,6%) (`n3cycle_r3.jsonl`, 12 mundos, período 6). Ou seja, três clientes afetados pelo mesmo calendário "confirmam" o viés. O documento reconhece o limite (seção 5) e mitiga pela corroboração, que, como visto, herda o viés.

**A regra de efeito mínimo, definida na escala do gerador, é implementável?**

* Beta é 7% a 20% do efeito aditivo injetado, côncavo (`atenua_r3.jsonl`, 40 grupos, 18 meses, descarte 3):

| Caso | Efeito injetado | Beta médio | Razão |
|---|---|---|---|
| Base, 8 SED | 0,05 | 0,0102 | 0,20 |
| Base | 0,10 | 0,0186 | 0,19 |
| Base | 0,20 | 0,0301 | 0,15 |
| Base | 0,40 | 0,0450 | 0,11 |
| 4 SED | 0,10 | 0,0200 | 0,20 |
| 16 SED | 0,10 | 0,0191 | 0,19 |
| A persistente (AR 0,8) | 0,10 | 0,0181 | 0,18 |
| **Efeito só nos lags 1 e 2** | 0,10 | 0,0069 | **0,07** |
| Efeito só nos lags 4 a 6 | 0,10 | 0,0143 | 0,14 |
| Participações desiguais | 0,10 | 0,0205 | 0,20 |

  O desvio entre simulações de beta é 0,0075 a 0,0087 em todos os casos, ou seja, cerca de 40% do beta esperado para efeito 0,10 e igual ao beta de efeito 0,05. A razão varia por fator de 3 com a **forma temporal** do efeito, que ninguém conhece. Portanto o "efeito mínimo na escala do gerador" depende da forma do gerador; o mapeamento beta para efeito não é identificável. O que se pode implementar é um corte em beta (por exemplo 0,0189) como regra de decisão, sem interpretação em efeito real. Esse corte reduz bastante a chance de passar: 40×18, RR 2: de 64% para 42%; 60×12: de 60% para 32%; sob a nula, de 3,5% a 5,3% para 0% a 1,3% (`N3_estat_e_beta_ge_0_0189`). A tabela de probabilidade da seção 7 do documento **não inclui** essa regra, embora ela esteja listada no nível 3; o número publicado superestima o nível 3 por 20 a 30 pontos.

## 5. Pergunta D: controle negativo unilateral a 1%

Medi em um cliente, 20 grupos (40 nos casos de efeito aditivo), 500 simulações, `ctrl_r3.jsonl`:

| Mundo | Primário rejeita 5% | Controle rejeita 1% | Primário rejeita e controle limpo | Falsos positivos barrados pelo controle |
|---|---|---|---|---|
| Nula base | 6,2% | 1,6% | 6,2% | 0% |
| Ciclo de grupo, período 6 (12 mundos) | 14,4% | 10,2% | 14,4% | **0%** |
| Ciclo com fases crescentes com o índice da dívida | 63,0% | 0,0% | 63,0% | 0% |
| Causa comum com atraso (12 mundos) | 9,0% | 2,6% | 9,0% | 0% |
| Transitório lento (tau 6, dp 1,5) | 11,4% | 0,0% | 11,4% | 0% |
| Efeito real RR 3 (gerador do documento) | 80,8% | 0,0% | 80,8% | |
| Efeito real em 6 pares fora da matriz | 1,8% | **3,2%** | 1,8% | |
| Efeito real em 12 pares fora da matriz | 1,6% | **6,6%** | 1,6% | |
| Efeito real em 30 pares da matriz e 6 fora | 70,6% | 0,0% | 70,6% | |

* **Ele não barra nenhum falso positivo do primário.** Em todos os mundos de viés simulados, a rejeição do primário e a do controle nunca coincidem. A causa é estrutural: 16 dos 30 pares da matriz têm o recíproco entre os pares de controle, e o escore direcional é antissimétrico, então quando a matriz fica positiva o controle fica negativo. A correlação entre o t do primário e o do controle é menos 0,55 sob a nula e menos 0,60 em mundos de ciclo (`antisim_r3.txt`). Um viés espúrio que torna a matriz positiva torna o controle negativo e o unilateral superior nunca vê.
* **Quando dispara**: efeito real em pares fora da matriz (3% a 7% com 40 grupos e efeito aditivo de 0,15 em 6 ou 12 pares) e em mundos de ciclo em que o primário fica negativo (10,2%). É informação sobre a matriz, como o documento diz, não proteção contra falso positivo.
* **Sob a nula passa 98,4%** (documento: 98% a 99%), certo.
* **Conclusão**: o controle unilateral resolve o problema de "invalidar métodos válidos", mas não oferece nenhuma proteção contra os erros que a rodada 2 apontou. Um controle útil teria de ter a mesma direção do viés: por exemplo pares de controle **sem recíproco na matriz** (60 menos 16 igual a 44 pares) e comparar com o primário em um teste de diferença, ou a "referência por controles" (mas essa descalibrou, seção 6). Registro como limitação, não como defeito de código.

## 6. Pergunta E: variantes descartadas

Confirmei os números qualitativos e o essencial dos quantitativos (`variantes_r3.jsonl`, `ref_r3.jsonl`). Rejeição sob a nula, G 20, 18 meses de teste mais 3 de descarte, %:

| Cenário | v3 do documento | Tendência de grupo (nos dois) | Tendência só no desfecho | Tendência só na exposição | Janela cheia | Descarte 6 |
|---|---|---|---|---|---|---|
| Base | 5,3 | 5,4 | 5,0 | 5,5 | 6,8 | 6,0 |
| Transitório tau 4, dp 1,5 | 10,0 | 5,1 | 5,4 | 4,9 | 11,8 | 8,0 |
| Transitório tau 6, dp 1,5 | 13,4 | 5,0 | 4,5 | 5,1 | 18,1 | 9,1 |
| Escalonado tau 4 | 10,9 | 2,9 | 2,6 | 3,8 | 13,9 | 10,6 |
| Ciclo período 6 (12 mundos) | 13,4 | 14,5 | 14,4 | 14,8 | 10,3 | 12,9 |
| Ciclo período 4 | 9,1 | 10,4 | 10,3 | 10,4 | 13,6 | 8,2 |
| Causa comum com atraso | 7,8 | 7,3 | 7,2 | 7,0 | 13,9 | 7,3 |
| Poder rampa RR 2, 40 grupos, 12 meses | 49,3 | 21,5 | 24,0 | 23,8 | 31,3 | 29,0 |
| Poder rampa RR 3 | 81,3 | 42,8 | 46,5 | 43,5 | 59,3 | 59,8 |
| Poder aditivo 0,10 | 39,0 | 28,8 | 31,0 | 29,0 | 17,3 | 30,3 |

* **Tendência por grupo**: o documento diz que "resolve o transitório (3,5% a 4,5%) e derruba o poder (58% para 14%)". Confirmo a direção: resolve (5,0% a 5,4%, escalonado 2,6% a 3,8%) e corta o poder pela metade ou mais (49% para 21% a 24% nos meus números). Os 14% do documento são de uma célula com piso 3 e outro gerador (arquivo `fase3_poder.txt`). Tirar a tendência só do desfecho ou só da exposição dá o mesmo resultado.
* **Janela cheia**: o documento diz "piora o falso positivo em ciclo e causa comum (10% a 16% na média)". Confirmo que piora no ciclo de período 4 (9,1% para 13,6%) e na causa comum com atraso (7,8% para 13,9%), mas **melhora** no ciclo de período 6 (13,4% para 10,3%), o que também aparece no arquivo do documento (14,1% para 10,0%). A frase está correta só em parte.
* **Referência por controles**: 15,7% na base e 14,7% com causa comum forte (300 simulações, 99 reamostragens), o documento diz 13% a 28%. Confirmo a descalibração.
* **Alguma descartada merece ser retomada?** Não como está. A tendência por grupo é a que corrige o transitório lento, mas custa metade do poder; poderia ser usada **como análise de sensibilidade pré especificada** (reportar se o resultado sobrevive), não como primária.
* **Variante nova que tentei e que ajuda um pouco**: tratar o mês suprimido como **ausente** e não como participação zero na exposição (que é o que `estimador2.mjs` faz quando o mês tem N igual a zero). Com piso proxy 5 SED, G 40: aditivo 0,10: de 59,6% para 63,0%; rampa RR 2: de 75,0% para 79,2%; com piso proxy 7: de 32,2% para 39,0% e de 56,4% para 66,6%. O falso positivo não muda (5,6% e 6,2%; 4,0% e 3,8%). Ganho de 3 a 10 pontos, sem custo. Recomendo.
* **Variante nova que não ajuda**: descarte de 6 meses de calendário (reduz o transitório lento a 7% a 11%, mas custa mais poder), descarte por grupo a partir da entrada (não melhora o escalonado).

## 7. Pergunta F: privacidade

**SQL.** `group_cycle_release()` agrega `por_pessoa` (contagem de SED por `contributor_token` no grupo e ciclo) e libera o grupo e ciclo se `count(*) >= 5 AND max(n) * 2 <= sum(n)`. Verifiquei por leitura: a contagem de distintos é correta, a dominância é `no máximo 50%` (inclusivo no limite), o ciclo precisa estar encerrado, e o filtro é por `app.tenant`. `review_engine` recebe EXECUTE em `adjacency_release()` e `group_cycle_release()`; `review_report` e `review_ingest` ficam sem.

**O teste cobre o que diz?** Cobre: grupo de 5 participantes com 1 SED cada (liberado), grupo de 4 (suprimido pelo piso), grupo de 5 em que um passa de 50% (7 de 11, suprimido), `cli_b` vazio, recusa 42501 de `review_ingest` e `review_report` nas duas funções, e o teste de `adjacency_release` agora usa `review_engine`. Não cobre: (1) o limite exato de 50% (o caso inclusivo `max*2 = sum`); (2) que `review_engine` **não** consegue executar `sed_release()`, `survey_release()` nem ler as tabelas (privilégio mínimo); (3) o isolamento entre clientes com dado nos dois lados (`cli_b` pode estar vazio ou ter um só participante, o que passaria mesmo sem o filtro `app.tenant` por causa do piso); (4) que `app.tenant` é definido pelo chamador, então o papel pode ler qualquer cliente se quiser (por desenho, já que o Stouffer usa vários clientes; é política, não barreira); (5) vários ciclos, o que é exatamente o cenário de diferenciação. Nada disso invalida o teste; as lacunas (1) e (2) são as que eu fecharia.

**Risco de reidentificação, mesmos volumes** (`priv_r3.txt`, 100 mil grupos e meses simulados por célula, SED atribuídos a participantes uniformemente ou com atividade desigual, dívidas equiprováveis):

| Participantes ativos, atividade | SED por mês | Grupos e meses liberados | Exatamente 5 distintos entre os liberados | Todas as dívidas com contagem 1 | Ao menos uma dívida com contagem 1 | SED em células de contagem 1 |
|---|---|---|---|---|---|---|
| 8, igual | 4 | 16% | 72% | 12% | 99% | 53% |
| 8, igual | 8 | 67% | 42% | 3,3% | 99% | 41% |
| 8, igual | 16 | 98% | 7% | 0,1% | 98% | 20% |
| 12, igual | 8 | 78% | 26% | 4,3% | 99% | 42% |
| 20, igual | 8 | 84% | 18% | 5,1% | 99% | 43% |
| 8, desigual | 8 | 6% | 94% | 1,7% | 99% | 37% |
| 12, desigual | 8 | 10% | 86% | 2,0% | 99% | 37% |
| 20, desigual | 16 | 99% | 3% | 0,1% | 98% | 20% |

O que **sobra**: (1) com 5 a 6 participantes liberados, a contagem de cada dívida quase sempre é 1 ou 2, de modo que o padrão do grupo e ciclo equivale à lista das dívidas de cada pessoa menos a ordem; quem conhece o próprio SED aprende o conjunto das outras 4 pessoas, e dois cúmplices aprendem os 3 restantes; (2) a diferenciação entre ciclos (entrou ou saiu uma pessoa) continua; (3) a dominância de 50% não protege contra o segundo participante dominante (dois pessoas com 40% cada); (4) a **supressão é informativa**: o mês suprimido indica baixa participação ou dominância, o que o analista vê; (5) com 16 SED o risco por célula cai (20% dos SED em células de contagem 1), mas grupos de 5 pessoas continuam descritos por dívidas únicas.

**Suficiência da política** ("só estatísticas agregadas entre grupos e no mínimo 10 grupos por cliente"): **insuficiente como regra de aplicação sem imposição**. O banco devolve linhas por grupo para qualquer chamada do papel; a regra de 10 grupos não é verificada em lugar nenhum; não há registro de consulta. O que eu faria no banco: (a) criar a análise como função que devolve **apenas os escores agregados entre grupos de um cliente** e se recusa abaixo de 10 grupos liberados (SECURITY DEFINER, sem expor contagens por grupo); (b) registrar cada chamada (papel, cliente, hora, número de grupos) em tabela de auditoria; (c) elevar o piso para 8 participantes distintos ou liberar o total sem a divisão por dívida abaixo disso; (d) dominância por dois participantes (os dois maiores somam no máximo 70%); (e) tratar a suprimida como dado faltante no analista e proibir que ela vá a qualquer saída. Nada disso foi implementado; é recomendação.

**Custo em poder do que a regra de fato impõe.** O proxy de "5 SED por grupo e mês" usado em todas as simulações deixa o analista com cerca de 90% dos grupos e meses quando a média é 8 SED. A regra real (5 distintos e dominância) libera de 0,1% a 98% conforme o número de participantes e a desigualdade de atividade (tabela). Medi o poder quando uma fração dos grupos e meses some ao acaso (aditivo 0,10, 40 grupos, 18 meses de teste): 0%: 81%; 20%: 59%; 40%: 36%; 60%: 18%. Portanto os números da seção 6 estão no melhor caso. A fase 1 deveria medir a fração real de grupos e meses liberados antes de o piloto ser dimensionado.

## 8. Pergunta G: poder

**Reprodução** (`poder_tabela_r3.txt`, 400 simulações, gerador do documento para a rampa e o meu gerador para o aditivo, piso proxy 5 SED, descarte 3). Doc / meu:

| Grupos, meses | Rampa RR 2 | Rampa RR 3 | Aditivo 0,10 |
|---|---|---|---|
| 20, 12 | 34 / 30,5 [26; 35] | 61 / 58 [53; 63] | 30 / 24 [20; 28] |
| 40, 12 | 54 / 52 [47; 57] | 84 / 83 [79; 86] | 46 / 43 [38; 48] |
| 60, 12 | 64 / 67 [62; 72] | 95 / 94 [91; 96] | 56 / 55 [50; 60] |
| 100, 12 | 88 / 85 [81; 88] | 99 / 100 | 80 / 74 [69; 78] |
| 40, 18 | 74 / 69 [64; 73] | 97 / 97 | 64 / 63 [58; 67] |
| 60, 18 | 88 / 90 [87; 93] | 99 / 100 | 74 / 79 [75; 83] |
| 100, 18 | 96 / 98 | 100 / 100 | 93 / 94 |
| 40, 24 | 87 / 85 | 99 / 100 | 77 / 76 |
| 60, 24 | 96 / 97 | 100 / 100 | 93 / 93 |

O documento reproduz 27 de 27 células do seu arquivo `fase3_poder_final.txt` (verifiquei) e meu código concorda dentro do erro. A pior distância é 100×12 aditivo: 80 contra 74 [69; 78].

**Cegueira a efeito constante e quase cega a efeito rápido** (`poder_forma_r3.txt`, G 40 e 100, 18 meses): rampa RR 2: 69% e 98%; **degrau (constante) RR 2: 6% e 10%**; aditivo janela do estimador: 63% e 94%; aditivo só lags 1 e 2: **19% e 33%**; só lags 4 a 6: 46% e 84%. Confirmado: 4% a 12% para efeito constante, 6% a 38% para efeito rápido.

**Limitação do desenho ou do gerador?** Dos dois, em partes distintas:

* Efeito **constante**: limite do **desenho**. O estimador mede covariação entre a participação de A (defasada) e a de B nas séries de grupos e meses. Se o efeito é igual para qualquer nível de A (efeito de limiar presente ou ausente que acompanha todos os grupos), a participação de B sobe em todo lugar e o centrado por mês remove tudo. Nenhum estimador baseado só em variação de A resolve; só uma variação exógena de A, ou contraste com grupos sem A. O gerador `step` torna o caso extremo (liga em qualquer exposição, e com 8 SED quase todo grupo e mês tem exposição).
* Efeito **rápido**: limite do **desenho com o gerador**. A média das defasagens de 1 (ou do prazo) a 6 dilui o sinal de lags 1 e 2. Janela mais curta aumentaria o poder para efeito rápido, mas é exatamente a classe "imediata" que o documento diz não validar.

**Anomalia do poder não monótono em volume**: do gerador de efeito, e o texto explica **corretamente**. O gerador `RR elevado a min(1, ex/3)` satura pela contagem absoluta de A; a 16 e 32 SED por mês todos os grupos e meses saturam e o efeito vira constante, para o qual o teste é cego. Medi (`poder_lam_r3.txt`, G 40, 18 meses): rampa RR 2: 4,3% (2 SED), 20,8% (4), 68,8% (8), 62,0% (16), **12,8% (32)**; rampa RR 3: 4,5, 41,3, 97,0, 91,0, **18,8**. O gerador aditivo (sem saturação) fica monótono até a estabilização: 3,3, 16,3, 62,5, 75,3, 72,8. Portanto a frase do documento ("o poder nem sempre cresce com o volume neste gerador, porque o efeito simulado satura pela contagem absoluta de A") é verdadeira e a conclusão prática é que o tamanho da fase 2 não deve ser calibrado com o gerador de rampa em volumes acima de 16.

## 9. Pergunta H: texto contra os arquivos

| Passagem | Arquivo | Resultado |
|---|---|---|
| Seção 5, tabela de início de programa (5 linhas) | `fase3_burn.txt` | Confere linha a linha (5,3 e 4,9; 9,1 e 5,8; 18,1 e 9,0; 5,6 e 4,9; 5,3 e 4,3) |
| Mesma tabela, linha "autocorrelação começando em zero: 4,9% com descarte" | `fase3_robustez_G20_T18.jsonl` | **Diverge**: o outro arquivo dá 8,8% com descarte 3 (e 6,3% com 2). Também 4,3% contra 6,0% na tendência de grupo de sinais opostos, 5,8% contra 4,8% no transitório de 2 meses. Os dois arquivos usam amostras diferentes; as diferenças de até 4 pontos mostram o ruído (~3 pontos com 200 simulações). Meu número: 5,8% [5,0; 6,7] (3000 simulações) |
| Seção 5, "entre 3,9% e 7,5% (nominal 5%) ... levemente liberal" | `fase2_*`, `fase3_*` | Plausível; o 7,5% vem de `fase2_controle.jsonl` (base). Outras células da v3 chegam a 8,8% (robustez, ar zero) e 7,8% (v2 em tendência de grupo). Meus: 5,0% a 6,5% nos reversíveis (rodada 2) |
| Seção 5, tabela "não resolvidos" (14,9% e 90%; 8,4% e 33%; 6,6% e 14%) | `fase3_ref_fp.txt` (coluna t) | Confere. `fase3_robustez` dá média 13,7% e máximo 74,5%, 8,4% e 36%, 7,4% e 12% para as mesmas famílias: as médias concordam, o máximo é ruidoso (200 a 300 simulações por mundo). Meus: 13,4%, 9,1%, 7,8% |
| Seção 4, "Remover tendência: 3,5% a 4,5% ... 58% para 14%" | `fase3_robustez`, `fase3_poder.txt` | Confere nos arquivos; meus números qualitativos concordam (5,0% a 5,4%; 49% para 21% a 24%). O 14% é de piso 3 e de outro gerador |
| Seção 4, "Janela única piora o falso positivo em ciclo e causa comum (10% a 16% na média)" | `fase3_robustez` | **Parcial**: em ciclo de período 6 a janela cheia **melhora** (14,1% para 10,0% no arquivo; 13,4% para 10,3% nos meus), piora em período 4 e em causa comum com atraso |
| Seção 4, "Referência por controles 13% a 28%" | `fase3_ref_fp.txt` | Confere (13,0 a 28,5); meus 15,7% e 14,7% |
| Seção 4, "beta é 13% a 22% do efeito injetado" | `fase3_atenuacao.jsonl` | Confere; não cobre efeito rápido (7%) |
| Seção 6, tabela (27 números) | `fase3_poder_final.txt` | Confere 27 de 27 |
| Seção 6, "efeito constante 4% a 12%; rápido 6% a 38%; 4 SED: 24% a 92%" | `fase3_poder_final.txt` | Confere |
| Seção 6, "meses de teste depois do descarte" | | Sim, mas oculta que o piloto custa 3 meses de calendário e 12 a 17 pontos de poder |
| Seção 7, tabela de probabilidade do nível 3 (15 números) | `fase3_niveis.jsonl` | Confere; **não inclui** a regra de efeito mínimo e a corroboração, que o nível 3 exige |
| Seção 7, "Sob a nula o controle passa 98% a 99%" | `fase3_niveis.jsonl` | Confere (97,8 a 99,0 nos meus) |
| Seção 3, "52 testes, nenhum falho" | | Não verificado por mim; aceito a informação do coordenador |
| Seção 3, "grupo com 5 em que um participante passa de 50% (suprimido pela dominância)" | `database.test.ts` | Confere (7 de 11); falta o limite exato |
| Nota no topo, "a simulação usa piso de 5 SED como proxy de 5 participantes distintos (um por participante)" | | O proxy é declarado, mas ignora a dominância, e o impacto é grande (seção 7 acima) |
| `estimador2.mjs` linha 1 | | Comentário diz "acrescenta ao v2: ... tendência por grupo, janela única" como parte do estimador final; o final é descarte apenas |

## 10. Pergunta I: notas

| # | Categoria | R1 | R2 | R3 | Justificativa da mudança em R3 |
|---|---|---|---|---|---|
| 1 | Validade do desenho | 4 | 6 | 6 | A afirmação foi reduzida a "precede", o limite de identificação foi declarado. Sem mudança porque a corroboração herda o viés e não condiciona o nível 3 |
| 2 | Erro tipo I | 4 | 6 | 6 | Reversíveis seguem calibrados; transitório rápido resolvido; lento (10% a 16%), escalonado (9% a 11%), ciclo e atraso (até 90%) não |
| 3 | Poder e dimensionamento | 3 | 5 | 6 | Tabela reproduz 27 de 27, cegueira a constante e rápido medida e declarada, anomalia de lam bem explicada. Descontos: custo do descarte não declarado, proxy de volume otimista |
| 4 | Modelo de dados da simulação | 3 | 5 | 5 | Mesmo gerador. Faltam transitório lento, entrada escalonada na calibração principal, supressão real por participante e dominância, ausência de mês tratada como zero |
| 5 | Critério de promoção | 4 | 5 | 6 | Regras impossíveis retiradas, nível 1 pré especificado, nível 2 com significância, controle unilateral. Descontos: controle sem função protetora, efeito mínimo fora da tabela e não implementável, sem consistência entre clientes |
| 6 | Medidas de efeito e intervalos | 3 | 4 | 4 | Beta tem limitação medida (7% a 20%, côncavo); IC ainda subcobre; sem RR |
| 7 | Qualidade de dados | 3 | 4 | 5 | Piso 5 e dominância entram na porta; kappa e deriva seguem pendentes; a fração liberada na prática não está dimensionada |
| 8 | Reprodutibilidade e implementação | 6 | 7 | 7 | Tudo reproduz e há resultados brutos. Dois arquivos de resultado divergem em até 4 pontos no mesmo cenário; teste SQL sem os casos de fronteira |
| 9 | Risco ético e de decisão | 6 | 5 | 6 | Piso 5, dominância, papel próprio e teste de recusa de papéis recuperam o que a v2 piorou. Falta imposição no banco da regra de 10 grupos e de agregação |
| 10 | Clareza e completude | 6 | 7 | 8 | Tabela de achados, limites explícitos ("sem solução"), pendências. Falta declarar o custo do descarte e a ausência da regra de efeito mínimo na tabela de probabilidade |

Médias: R1 4,2; R2 5,4; R3 5,9.

## 11. VEREDITO

**VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO**

1. **O método é viável como instrumento de fase exploratória interna?** Sim. Tem estimador calibrado em cenários reversíveis, descarte que resolve o transitório rápido, acesso restrito, nível 1 com cliente pré especificado e linguagem de associação. Fica ressalva: volume real liberado deve ser medido antes de qualquer promessa de poder.
2. **Em que condições ele pode sustentar o nível 3?** Só se todas as condições abaixo forem cumpridas:
   * evidência de que não há ciclo de grupo, atraso comum nem transitório lento relevantes no dado real (diagnóstico pré especificado e passado), ou desenho com variação exógena de A;
   * descarte e janela definidos com a forma do transitório medida na fase 1 (decaimento observado), e custo em poder dimensionado;
   * volume liberado medido com a regra real (5 distintos e dominância) e poder recalculado com ele;
   * efeito mínimo definido e testado no hash, com a consciência de que o beta não é interpretável (razão 7% a 20%), e a tabela de probabilidade do nível 3 refeita com essa regra;
   * corroboração por canal que seja demonstradamente insensível ao ciclo (por exemplo, pesquisa respondida por participantes distintos, em janela de tempo diferente), com seu poder calculado e exigida (não só reportada) no nível 3;
   * controle negativo com função protetora real (pares de controle sem recíproco na matriz, em comparação, e não só unilateral);
   * mês suprimido tratado como ausente; revisão externa e ata; imposição no banco da agregação mínima de 10 grupos.
3. **O que falta para o nível 4:** todo o anterior, mais duas apurações semestrais consecutivas, corroboração positiva como exigência, teste de compreensão com RH, revisão ética e jurídica da linguagem, função de análise que não devolve contagens por grupo, registro de consulta, e plano para o falso positivo exibido a RH (risco de ação sobre pessoas por associação espúria). Ninguém deveria ver a palavra "conversão".

**Os cinco problemas mais graves que restam:**

1. Ciclo de grupo e causa comum com atraso (falso positivo de 7% a 90%) não têm solução estatística; a corroboração herda o viés (11,7% contra 14,1%) e é só reportada no nível 3; três clientes com o mesmo calendário "confirmam" o viés em 14%.
2. O descarte de 3 meses não resolve transitório lento (10% a 16%) nem início escalonado (9% a 11%), e custa 12 a 17 pontos de poder, não declarados.
3. A simulação de poder pressupõe um volume que a regra real do banco não entrega: de 0% a 10% dos grupos e meses liberados em grupos de 5 a 12 pessoas com atividade desigual; com 20% de meses perdidos o poder cai de 81% para 59%.
4. O efeito mínimo (beta) não é implementável como grandeza de negócio (razão 7% a 20%, côncavo, dp igual a 40% do valor) e a tabela de probabilidade do nível 3 não o inclui (superestima por 20 a 30 pontos); sem teste de heterogeneidade, efeito em um só cliente passa o nível 3 em 16% a 24%.
5. O controle negativo unilateral é estruturalmente anticorrelacionado com o primário (menos 0,55 a menos 0,60) e não barra nenhum falso positivo; e as regras de privacidade (10 grupos, agregação) são só política, com lacunas no teste (limite exato, privilégio mínimo, isolamento com dado nos dois lados).

**Os cinco pontos mais fortes:**

1. Honestidade metodológica: afirma só "precede", declara os mundos sem solução, o efeito constante e rápido invisíveis, e o beta atenuado.
2. Estimador direcional calibrado em cenários reversíveis (5% a 6,5% nas rodadas 2 e 3) e transitório rápido resolvido pelo descarte.
3. Tabela de poder reproduzível (27 de 27, e concordância com meu código), com a anomalia de volume corretamente explicada.
4. Retirada das regras impossíveis (50% do peso, heterogeneidade, Brier, placebo de tempo), nível 1 com cliente pré especificado (5% de falso positivo contra 16% a 18% de livre escolha), nível 2 com significância.
5. Piso de 5, dominância, papel próprio e teste de recusa de papéis; pendências e limites publicados no próprio documento.

**Grau de confiança:** alto (cerca de 85%) nos achados reproduzidos com código (descarte, custo de poder, controle antissimétrico, efeito constante, tabela de poder, nível 3 sob as regras do documento); moderado (cerca de 65%) nas magnitudes de ciclos, transitórios, corroboração e privacidade, que dependem de cenários e de modelos de participação que são hipóteses minhas.

**O que não consegui verificar:**

* A execução dos testes do banco (li o SQL e o teste; não rodei PostgreSQL). Aceito a informação de que os 52 passam.
* O comportamento real do classificador, do volume real por participante, a frequência real de transitórios, ciclos de grupo e atrasos comuns.
* A matriz completa de adjacência contra o Documento 1.
* O desempenho da corroboração com uma pesquisa real: modelei um sinal contínuo por grupo e ciclo; a pesquisa real pode ter outra estrutura.
* Calibração das 3 classes de prazo, erro de classificação e participante repetido para o direcional da v3.
* A reidentificação por atacantes reais (modelei só a estrutura das contagens).

Código e resultados: `auditoria_externa/rodada3/`. `r3_lib.mjs` (escorer próprio, confere com `estimador2.mjs`), `r3_gen.mjs` (gerador próprio), `r3_burn.mjs`, `r3_escalonado.mjs`, `r3_arzero.mjs`, `r3_degrau.mjs`, `r3_corrob.mjs`, `r3_niveis.mjs`, `r3_n3cycle.mjs`, `r3_atenua.mjs`, `r3_ctrl.mjs`, `r3_antisim.mjs`, `r3_variantes.mjs`, `r3_ref.mjs`, `r3_missing.mjs`, `r3_priv.mjs`, `r3_poder.mjs`. `nucleo.mjs`, `estimador2.mjs` e `gerador2.mjs` são cópias literais dos arquivos do repositório.
