# Auditoria estatística externa, rodada 2

Alvo: versão 2 do método (commit baa2740): `METODO_ADJACENCIA.md`, `nucleo.mjs`, `estimador.mjs`, `fase2_*.mjs` e resultados `fase2_*.jsonl`, `fase2_poder.txt`, `group_cycle_release()` em `schema.sql`, `grants.sql`, teste novo em `database.test.ts`. Mesma independência da rodada 1. Nada do repositório foi alterado além deste relatório e da pasta `auditoria_externa/rodada2/`. Sem commit, rede, API paga ou Drive.

Como li: reimplementei o estimador direcional do zero a partir da descrição do documento (`r2_lib.mjs`, função `escores`). Conferi contra `estimador.mjs` em 30 conjuntos de dados: diferença relativa máxima entre os escores por grupo de 7,3 vezes 10 elevado a menos 13, ou seja, as duas implementações coincidem (`r2_checa.mjs`). Os cenários novos usam um gerador próprio (`gen`), escrito sem copiar `nucleo.mjs`. Os cenários de poder com o gerador do documento usam `nucleo.mjs` copiado sem alteração, com o MEU estimador. IC95 de Wilson entre colchetes.

## 1. Resumo

1. A engenharia melhorou muito: exposição por A como principal, estimador direcional, centragem por mês, t por grupo, liberação agregada que devolve poder, critérios quebrados da rodada 1 retirados. O estimador direcional é calibrado (cerca de 5% a 6,5%) em 30 dos 35 cenários adversos que testei, inclusive os que o autor não simulou.
2. O argumento de simetria (defasagem versus avanço) vale **só para processos temporalmente reversíveis**. Ele falha em três famílias plausíveis: transitório inicial compartilhado (9% e 19%), ciclos de grupo com fase por dívida (até 58% em alguns mundos) e causa comum com atraso (até 21%). Nessas famílias o método confunde precedência calendária com conversão.
3. O poder da seção 6 reproduz (12 de 12 células dentro do erro). Mas o gerador favorece o estimador: efeito consolidado em todas as defasagens de 2 a 6 meses. Em degrau o poder cai de 79% para 41% (40 grupos, 18 meses, RR 2). Se o efeito for rápido (defasagens 1 e 2) o poder é 38%.
4. O nível 3 da versão 2 **não tem efeito mínimo de interesse**. Só exige p abaixo de 5%. A unidade do "efeito" (beta) é uma inclinação que subestima em cerca de 55% o efeito injetado, e não há RR.
5. O controle negativo agrupado não é contaminado no sentido de gerar alarme falso, mas é contaminado no sentido oposto: efeito real faz o controle ir para t negativo (média de menos 2,5), então "controle limpo" se torna menos informativo. Quando a matriz está incompleta (efeito em pares fora dela), o controle invalida o método: 16% com 6 pares, 35% com 12.
6. Os critérios de nível 3 são alcançáveis (cerca de 70% de chance de passar a parte estatística com 40 grupos por 18 meses ou 60 por 12, 3 clientes iguais, RR pico 2, efeito em rampa), mas a regra de 50% do peso mata o nível 3 por construção quando um cliente é maior que a metade (0% medido).
7. A privacidade piorou em relação à v1 e hoje depende de política, não de barreira técnica. O piso de 3 participantes com contagens completas por dívida permite atribuição ao conjunto de 3 pessoas.
8. Veredito: **VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO** (seção 11). Média das notas: de 4,2 para 5,4.

## 2. Pergunta A: erro tipo I do estimador direcional

Estimador: exposição = participação de A como principal, média das defasagens do prazo até 6 meses; escore de defasagem menos escore de avanço; centragem por mês entre grupos; t unilateral sobre os escores por grupo, 5%. 4000 simulações por cenário, 20 grupos, 12 meses, 8 SED por grupo e mês, salvo indicação. Arquivos `resultados/fp_r2.jsonl` e `fp_r2_B.jsonl`. A coluna "só defasagem" é a versão ingênua, para contraste.

| Cenário nulo | Direcional rejeita, % [IC95] | Só defasagem, % |
|---|---|---|
| Base | 6,0 [5,3; 6,7] | 5,0 |
| Tendência comum, A sobe e B desce | 5,3 [4,6; 6,0] | 5,5 |
| Tendência comum só em dívidas pares | 5,5 [4,8; 6,2] | 4,9 |
| Tendência de grupo independente por dívida | 5,4 [4,8; 6,2] | 2,8 |
| Tendência de grupo com cargas de sinal oposto (A sobe, B desce, por grupo) | 5,7 [5,0; 6,4] | 12,2 |
| Tendência de grupo, mesmo sinal | 5,5 [4,8; 6,2] | 4,8 |
| Sazonalidade comum, fases opostas (A e B em contrafase) | 5,8 [5,2; 6,6] | 5,4 |
| Sazonalidade comum, fases aleatórias | 5,3 [4,7; 6,1] | 5,6 |
| Ciclo de grupo, mesma fase para todas as dívidas | 5,3 [4,6; 6,0] | 5,3 |
| Grupos desiguais, 2 SED | 5,8 [5,1; 6,5] | 4,6 |
| 1 SED por grupo e mês | 5,0 [4,4; 5,7] | 4,5 |
| 2 SED por grupo e mês | 5,7 [5,0; 6,4] | 4,9 |
| 6 grupos | 5,9 [5,2; 6,7] | 6,0 |
| 8 grupos | 5,7 [5,0; 6,4] | 5,9 |
| 10 grupos | 6,4 [5,7; 7,2] | 6,4 |
| 6 meses | 5,5 [4,8; 6,2] | 5,5 |
| 9 meses | 5,4 [4,8; 6,2] | 5,7 |
| 6 grupos, 6 meses, 2 SED | 6,5 [5,8; 7,3] | 5,5 |
| Autocorrelação com sinal oposto, A e B se alternando (fator persistente com cargas +1 e menos 1) | 6,2 [5,4; 6,9] | 0,0 |
| Autocorrelação negativa (rho menos 0,7, alternância mês a mês) | 6,5 [5,8; 7,3] | 5,5 |
| Autocorrelação negativa por dívida (rho menos 0,6) | 5,1 [4,5; 5,9] | 3,9 |
| Autocorrelação 0,9 | 5,2 [4,5; 5,9] | 0,0 |
| Causa comum, 3 fatores, cargas de sinal oposto, forte | 5,4 [4,7; 6,1] | 0,0 |
| Causa comum, mesmo sinal, forte | 5,3 [4,7; 6,1] | 0,0 |
| Meses suprimidos em 30%, 4 SED | 5,4 [4,8; 6,2] | 5,7 |
| Participações muito desiguais (uma dívida domina) | 5,7 [5,0; 6,5] | 6,9 |
| Binomial negativa, 2 SED | 5,5 [4,8; 6,2] | 5,0 |
| Rampa de volume (cresce de 0,3 a 1,5 vezes) | 5,6 [5,0; 6,4] | 5,3 |
| Rampa de volume (cai de 1,5 a 0,3) | 5,3 [4,6; 6,0] | 5,2 |
| Adverso total (10 grupos, 4 SED, grupos desiguais, AR, tendência de grupo de sinais opostos, fator, sazonalidade, 20% de meses suprimidos) | 5,2 [4,5; 5,9] | 1,4 |
| **Autocorrelação começando em zero (não estacionária)** | **6,8 [6,1; 7,6]** | 0,3 |
| **Transitório inicial compartilhado por bloco, decai em 2 meses** | **9,0 [8,2; 9,9]** | 14,1 |
| **Transitório inicial forte, decai em 4 meses** | **19,1 [17,9; 20,3]** | 59,8 |
| **Ciclo de grupo com fase por dívida (um mundo)** | **7,7 [6,9; 8,5]** | 2,7 |
| **Causa comum com atraso diferente por dívida (um mundo)** | **16,0 [14,9; 17,2]** | 20,6 |

Em vários mundos sorteados (`r2_mundos.mjs`, 15 mundos, 1000 simulações cada, fases e atrasos aleatórios):

| Tipo | Taxa média | Mediana | Máxima | Mundos acima de 10% |
|---|---|---|---|---|
| Ciclo de grupo com fase por dívida | 12,7% | 3,7% | 57,6% | 5 de 15 |
| Causa comum com atraso por dívida | 8,3% | 6,2% | 20,9% | 4 de 15 |

Leitura:

* **Calibração geral**: 5,0% a 6,5% nos cenários reversíveis, com excesso médio de cerca de 0,5 a 1 ponto sobre o nominal. Em 10 grupos ou menos, 5,7% a 6,5%. É levemente liberal, não 5% exato. O teste de inversão de sinais dá o mesmo (`signflip_r2.jsonl`: 4,3% a 7,0%), então é propriedade dos escores, não do uso do t.
* **Há cenário plausível em que infla**: três famílias, todas com a mesma raiz, tempo com direção (seção 3). A primeira, o transitório inicial compartilhado, é provável em piloto (novidade, onboarding, mudança de rotina no começo). Não sei com que frequência ocorrem; são hipóteses minhas.
* Na prática a causa comum persistente, que derrubava a versão ingênua, foi bem neutralizada (5,3% a 5,4% mesmo com sinais opostos).

## 3. Pergunta B: a simetria é válida?

**Argumento.** Se o processo nulo é estacionário e reversível no tempo, a distribuição de cada escore de defasagem é igual à do escore de avanço com o tempo invertido. A disponibilidade desigual de meses nas bordas se compensa: o mês t com k defasagens disponíveis é espelhado pelo mês T menos 1 menos t com k avanços. Logo o valor esperado da diferença é zero, e a diferença é simétrica em torno de zero. Verifiquei empiricamente que isso vale para AR positivo e negativo, causa comum, tendência, sazonalidade e volume decrescente ou crescente (tabela acima).

**Onde falha.** A simetria exige reversibilidade. Qualquer ruído com direção temporal quebra a compensação:

1. **Transitório inicial** (9% e 19%): no começo, A e B do mesmo bloco estão altas por novidade; a defasagem de um mês inicial vê esse excesso, o avanço não.
2. **Início não estacionário** (autocorrelação começando em zero): variância cresce no tempo, 6,8%.
3. **Ciclos de grupo com fase própria e deslocamentos fixos entre dívidas**, e **causa comum com atraso**: A precede B por calendário, sem conversão. Isso é identificação, não calibração: nenhum desenho observacional só com contagens separa "A converte em B" de "A e B respondem ao mesmo choque com atrasos diferentes". O documento já diz "antecede", mas o nível 3 chama o resultado "confirmado" e promete um critério para exibir ao cliente.

**Restrição de soma 1 (viés composicional).** Não encontrei viés. Em participações muito desiguais (uma dívida com cerca de 40%) o erro foi 5,7%. A razão é a mesma da simetria: o termo composicional é igual no escore de defasagem e no de avanço. Em efeito real o termo composicional aparece como inclinação negativa dos pares de controle (seção 6) e como atenuação do beta (seção 5).

**Exposição como média das participações na janela.** Não produz viés nulo. Custa poder: com soma o poder é 54% (RR 2, 20 grupos, 12 meses, efeito em rampa) contra 35% com média (`fase2_dir2.jsonl`). A média ganha em efeito em degrau (31% contra 14%). A escolha foi feita olhando poder em dois geradores, antes de qualquer dado real; é legítima, mas deve entrar no hash como decisão congelada.

**Borda com T curto.** Com 6 meses e janela de 4 a 6 meses (prazo médio), defasagem e avanço usam meses disjuntos. No cenário nulo reversível o erro foi 5,5%, mas com transitório inicial esse caso piora (não medido separadamente).

## 4. Pergunta C: poder

Recalculei 12 células com o gerador do documento (efeito em rampa, driver A, `nucleo.mjs`) e o meu estimador, liberação agregada por grupo e mês com mínimo de 3 SED (500 simulações). `resultados/poder_tabela_r2.txt`:

| Grupos, meses, SED | RR 1,5 doc / meu | RR 2,0 doc / meu | RR 3,0 doc / meu |
|---|---|---|---|
| 20, 12, 8 | 18 / 21 [18; 25] | 37 / 35 [31; 39] | 69 / 64 [60; 68] |
| 40, 12, 8 | 33 / 27 [23; 31] | 58 / 60 [55; 64] | 91 / 91 [89; 94] |
| 60, 12, 8 | 36 / 36 [32; 40] | 77 / 73 [69; 77] | 99 / 97 [95; 98] |
| 100, 12, 8 | 50 / 52 [48; 57] | 90 / 90 [87; 93] | 100 / 100 |
| 20, 18, 8 | 29 / 26 [22; 30] | 53 / 51 [46; 55] | 87 / 86 [83; 89] |
| 40, 18, 8 | 50 / 43 [39; 48] | 82 / 81 [77; 84] | 100 / 100 |
| 60, 18, 8 | 55 / 53 [48; 57] | 92 / 91 [88; 93] | 100 / 100 |
| 40, 24, 8 | 55 / 60 [55; 64] | 91 / 90 [88; 93] | 100 / 100 |
| 40, 12, 16 | 37 / 36 [32; 40] | 70 / 73 [69; 76] | 97 / 97 [95; 98] |
| 40, 18, 16 | 46 / 47 [43; 52] | 82 / 80 [77; 84] | 99 / 99 |
| 20, 12, 4 | 10 / 11 [9; 14] | 16 / 19 [16; 23] | 33 / 27 [23; 31] |
| 100, 12, 4 | 25 / 23 [19; 27] | 49 / 52 [47; 56] | 85 / 83 [79; 86] |

36 de 36 valores concordam dentro do erro Monte Carlo (a maior distância, 40×12×8 com RR 1,5: 27 contra 33, é de cerca de 1,5 erro padrão da tabela do documento, que usou 300 simulações). Também a frase "para 80% contra RR 2,0, 40 grupos por 18 meses ou 60 por 12" se sustenta como ordem de grandeza (82% e 77%).

**O gerador favorece o estimador?** Sim, em três dimensões. 40 grupos, 18 meses, 8 SED, 400 simulações (`poder_favorece_r2.txt`):

| Modelo de efeito | RR pico 2 | RR pico 3 |
|---|---|---|
| Documento: rampa, A sem persistência | 79% [75; 83] | 99% |
| Rampa, A persistente (AR 0,8) | 78% | 97% |
| **Degrau, A sem persistência** | **41% [36; 45]** | 71% |
| **Degrau, A persistente** | **33% [29; 38]** | 55% |

Efeito aditivo conhecido (participação de B sobe em 0,15 vezes a participação média de A na janela do efeito), 40 grupos, 18 meses:

| Janela do efeito | A sem persistência | A persistente |
|---|---|---|
| Igual à do estimador (prazo até 6) | 99,8% | 100% |
| Só atrasos 4 a 6 | 90% | 89% |
| Só atrasos 1 e 2 | **38%** | 43% |
| Só atraso 1 | **16%** | 19% |

Interpretação: o estimador usa a média das defasagens de 1 (ou do prazo) a 6 meses. Se a conversão é rápida (a classe "imediata" é 0 a 1 mês), o sinal se dilui na média. O gerador do documento, com consolidação permanente em todos os lags até 6, é o caso mais favorável. Os números da seção 6 são, portanto, um teto sob efeito consolidado, não um piso. O autor registra "efeito em degrau" como não medido; eu medi: o poder cai pela metade.

## 5. Pergunta D: intervalo de 95% por inversão

Medi cobertura de três intervalos para a mesma inclinação: Fieller (o de `estimador.mjs`), Wald por delta e jackknife por grupo. 1500 simulações, `resultados/cobertura_r2.jsonl`.

| Cenário | Fieller | Wald delta | Jackknife |
|---|---|---|---|
| Nula, 20 grupos, 12 meses | 92,9 [91,5; 94,1] | 93,9 | 94,0 |
| Nula, 40 grupos, 18 meses | 93,1 [91,7; 94,3] | 94,9 | 94,9 |
| Nula, 10 grupos, 12 meses | 91,6 [90,1; 92,9] | 93,6 | 93,7 |
| Efeito aditivo, 20 grupos (vs valor populacional de referência) | 94,2 | 93,9 | 93,9 |
| Efeito aditivo, 40 grupos | 95,5 | 95,4 | 95,4 |
| Efeito aditivo, 40 grupos, A persistente | 93,8 | 93,6 | 93,9 |
| Efeito menor, 40 grupos | 94,9 | 94,7 | 94,7 |

Conclusão:

* **Não é defeito do código de inversão.** O Fieller na nula é exatamente o teste t bilateral primário em zero, cuja taxa de rejeição bilateral é de 7% a 8% (o teste unilateral rejeita 6%). Os mesmos escores com Wald e jackknife dão 93,6% a 94,9%. É **limitação do método**: t com G menos 1 graus de liberdade sobre escores não normais, liberal de 1 a 2 pontos. Aceitável na fase exploratória, desde que o critério use p valor (como o documento diz) e que a margem fique escrita. Para nível 3, o jackknife por grupo ou a inversão com bootstrap studentizado é preferível.
* **Cobertura do parâmetro que o estimador de fato estima**: 93,8% a 95,5%, boa. Cobertura do efeito injetado: 0% (beta 0,3) e 14% (beta 0,1). O beta estimado é cerca de 40% a 52% do injetado (0,12 contra 0,30; 0,052 contra 0,10). Causas: a renormalização das participações (somar 1) e o fato de o estimador tratar os 30 pares como regressores simples. O beta não é a inclinação de um par nem um RR; o documento deixa o limiar para a fase 1 "em escala padronizada" sem dizer como padronizar. Enquanto não houver essa definição, o intervalo não mede o que a regra de "efeito mínimo" precisaria.
* Os 92% a 93% citados no documento (seção 5) conferem com `fase2_dir.jsonl` (91,4% a 92,9%).

## 6. Pergunta E: controle negativo agrupado

O controle usa os 60 pares fora da matriz, com o mesmo estimador e prazos por rodízio. Os 60 pares compartilham A ou B com os pares da matriz: com efeito em todos os 30 pares da matriz, 60 de 60 controles compartilham; com efeito em 3 pares de origem D1, 24; nos pares que chegam em D6, 39.

Efeito aditivo conhecido (0,15), 40 grupos, 18 meses, 400 simulações (`controle_r2.jsonl`):

| Caso | Primário rejeita | Controle rejeita | t médio primário | t médio controle |
|---|---|---|---|---|
| Efeito em todos os 30 pares, A independente | 99,8% | 0,0% | 4,5 | **menos 2,5** |
| Idem, A persistente | 99,8% | 0,0% | 4,5 | menos 3,0 |
| Idem, causa comum persistente de sinais mistos | 100% | 0,0% | 4,5 | menos 2,8 |
| Efeito só nos 3 pares com A em D1 | 16% | 2,3% | 0,7 | menos 0,3 |
| Efeito só nos pares que chegam em D6 | 19% | 3,8% | 0,8 | menos 0,3 |
| Efeito só nos pares do bloco D1 a D4, com causa comum do bloco | 78% | 0,0% | 2,5 | menos 1,6 |
| **Efeito em 6 pares fora da matriz** | 2,3% | **15,8% [12,5; 19,6]** | menos 0,5 | 0,8 |
| **Efeito em 12 pares fora da matriz** | 1,3% | **35,3% [30,7; 40,1]** | menos 0,8 | 1,3 |

Resposta:

* **Faz sentido como teste único** (o p valor do conjunto substitui a taxa sobre 60 testes dependentes, que eu havia mostrado inválida). Sob a nula o controle rejeita 4,7% a 6,3% (`fase2_controle.jsonl`).
* **Contaminação**: existe, e tem **sinal negativo**. Efeito real em pares da matriz empurra o controle para t negativo (compositional: se B sobe, as demais participações caem). Isso não causa alarme falso, mas faz o "0% de rejeição sob efeito real" do documento significar pouca coisa: um viés espúrio positivo de tamanho comparável seria mascarado. O controle é um teste unilateral para cima, e sob efeito real é cego.
* **Matriz incompleta**: se existirem conversões fora da matriz (a matriz é uma hipótese do proprietário), o controle rejeita e a regra do documento ("o método é inválido para aquele cliente") invalida o método por um achado que é, na verdade, informação sobre a matriz. Com 6 pares reais fora, 16%; com 12, 35%.
* **Custo sob a nula**: a regra exige controle limpo em 3 clientes e no conjunto; a probabilidade de passar os quatro testes sob a nula é 79% a 84% (seção 8). Ou seja, 16% a 21% de invalidações indevidas por rodada, não 5%.

## 7. Pergunta F: critérios de promoção reescritos

Simulei 3 clientes, cada um com seus grupos e sua centragem por mês, gerador do documento (driver A, rampa), 400 simulações por célula (`niveis_r2.jsonl`). Nível 3 estatístico = Stouffer sobre os testes unilaterais por cliente com pesos iguais à raiz do número de grupos, p abaixo de 5%; heterogeneidade de Cochran (qui quadrado com 2 graus) com p acima de 5%; nenhum cliente com mais de 50% dos grupos; controle limpo em cada cliente e no conjunto (Stouffer). Não inclui revisão externa e ata. Nível 1 = um cliente com p abaixo de 5% e controle limpo (porta de qualidade assumida passada).

| Desenho | Efeito | Stouffer p<5% | Controles limpos | Nível 1, cliente 1 | Nível 1, algum dos 3 | Nível 3 estatístico |
|---|---|---|---|---|---|---|
| 40 grupos, 18 meses, 14/13/13 | RR pico 2 | 78% | 98% | 41% | 78% | **70%** |
| 40 grupos, 18 meses, 14/13/13 | RR pico 3 | 99% | 99% | 75% | 99% | 90% |
| 40 grupos, 18 meses, 14/13/13 | RR 2, degrau | 45% | 92% | 23% | 54% | 40% |
| 40 grupos, 18 meses, 14/13/13 | RR 2, A persistente | 75% | 98% | 38% | 73% | 70% |
| 60 grupos, 12 meses, 20/20/20 | RR pico 2 | 71% | 97% | 34% | 74% | **66%** |
| 60 grupos, 12 meses, 20/20/20 | RR pico 3 | 96% | 98% | 66% | 95% | 88% |
| 60 grupos, 12 meses, 20/20/20 | RR 2, degrau | 65% | 94% | 33% | 69% | 60% |
| 40 grupos, 18 meses, 20/12/8 | RR pico 2 | 75% | 99% | 54% | 78% | 67% |
| 60 grupos, 12 meses, 30/18/12 | RR pico 2 | 76% | 99% | 48% | 77% | 69% |
| 60 grupos, 12 meses, **36/14/10** | RR pico 2 | 71% | 97% | 53% | 72% | **0%** |
| 40 grupos, 18 meses, 14/13/13 | sem efeito | 5,3% | 83% | 5,0% | **13,3%** | 4,8% |
| 60 grupos, 12 meses, 20/20/20 | sem efeito | 7,0% | 84% | 5,3% | **15,5%** | 5,5% |
| 60 grupos, 12 meses, 30/18/12 | sem efeito | 4,3% | 82% | 5,3% | 13,8% | 3,0% |

Efeito só em parte dos clientes (RR pico 3 nos clientes com efeito, 1 nos demais; `niveis_het_r2.jsonl`):

| Desenho | Efeito | Stouffer p<5% | Heterogeneidade não significativa | Nível 3 estatístico |
|---|---|---|---|---|
| 60 grupos, 12 meses, 20/20/20 | 1 de 3 clientes | 30% | 67% | 19% |
| 60 grupos, 12 meses, 20/20/20 | 2 de 3 clientes | 75% | 61% | 47% |
| 40 grupos, 18 meses, 14/13/13 | 1 de 3 | 35% | 54% | 20% |
| 40 grupos, 18 meses, 14/13/13 | 2 de 3 | 78% | 58% | 44% |

Respostas:

* **Alcançáveis?** Sim, a parte estatística, com RR pico 2 em rampa, em torno de 66% a 70%; 40% a 60% com efeito em degrau; 90% para RR pico 3. Com outros 3 itens fora do modelo (revisão externa, ata, porta de qualidade) o produto real será menor. A chance de nível 1 em um cliente específico é só 34% a 54%.
* **Falso positivo do nível 3 sob a nula**: 3,0% a 5,5%. Ou seja, ele não é mais severo que o teste agrupado sozinho. Os portões (heterogeneidade, controle, 50%) quase não reduzem o erro tipo I; eles reduzem o poder. Pior: com causa estrutural comum a todos os clientes (ciclo de grupo, atraso), o Stouffer soma o mesmo viés, e o resultado "replicado em 3 clientes" não é replicação independente do viés (seção 3).
* **Nível 1 com "um cliente"** sem regra de qual: com 3 clientes e livre escolha, a chance de pelo menos um passar sob a nula é 13% a 16% (16% a 20% com o maior cliente de 60%). Deve-se pré especificar o cliente ou corrigir para 3 olhares.
* **Conflito entre as regras**:
  1. A regra de 50% torna o nível 3 **impossível com dados quaisquer** quando um cliente passa de 50% dos grupos (0% medido com 36/14/10), sem relação com o efeito. O texto não define "peso" (grupos? SED? peso de Stouffer?). Com 3 clientes e pesos iguais por cliente, a regra é vazia.
  2. Stouffer e heterogeneidade medem coisas diferentes: com efeito em 2 de 3 clientes, Stouffer passa 75% e heterogeneidade falha em 39%, e o nível 3 cai a 47%; com 1 de 3, 19%. O conjunto de regras pune bem a heterogeneidade real, mas com 3 clientes o teste de heterogeneidade tem poder baixo, então "não significativa" não prova consistência.
  3. Controle limpo em quatro testes (3 clientes mais conjunto) passa só 79% a 84% sob a nula.
* **O que falta no nível 3**: nenhum efeito mínimo. A tabela da seção 7 exige só p abaixo de 5%. O limiar prometido na seção 4 não aparece no critério. Com amostra grande qualquer efeito trivial confirma.
* **Nível 2**: "o sinal se repete no mesmo sentido" sem exigir significância passa por acaso metade das vezes.

## 8. Pergunta G: privacidade de `group_cycle_release()`

Leitura do SQL: libera `(grupo, ciclo, dívida principal, contagem)` para qualquer grupo-ciclo com pelo menos 3 `contributor_token` distintos no total (linhas adicionadas em `schema.sql` após a linha 188). Executável por `review_report`, o mesmo papel que executa `sed_release()` e `adjacency_release()` (`grants.sql`). O teste novo cobre 3 participantes com contagem 1 por dívida (liberado), 2 participantes (suprimido), outro cliente (vazio) e papel de ingestão (recusado). Não pude rodar: o ambiente não tem servidor PostgreSQL, então "52 testes, nenhuma falha" **não foi verificado por mim**.

**É risco real de reidentificação?** Sim, de dois tipos, ambos pequenos em probabilidade e relevantes em consequência:

1. **Atribuição ao conjunto de 3 pessoas.** O grupo de 3 participantes com 3 SED em 3 dívidas diferentes divulga o conjunto exato das 3 dívidas. Qualquer participante conhece a própria e, portanto, o par das outras duas; dois cúmplices conhecem a terceira completamente. Em volumes simulados (melhor caso, um SED por participante): com 4 SED por grupo e mês, 26% dos grupos-mês liberados têm exatamente 3 SED e 40% têm todas as contagens iguais a 1; com 8 SED, 3% e 11%; ao menos uma dívida com contagem 1 em 98% a 99% dos grupos-mês em todos os volumes (`privacidade_r2.jsonl`). O piso de 3 participantes distintos não limita o número de SED por participante: um participante dominante (por exemplo 20 dos 24 SED do grupo) é visível no padrão das contagens (regra do participante dominante ausente).
2. **Diferenciação entre ciclos.** Uma pessoa que entra ou sai muda o agregado: as contagens do ciclo com 3 contra o de 4 participantes revelam o conjunto que a pessoa adicionou.

**O argumento de que o dado é interno ao motor** não é barreira técnica: o mesmo papel serve o painel do cliente via `sed_release()`; a função devolve linhas por grupo; nada no SQL impede que uma consulta futura as exponha. O documento diz que o resultado "não sai do motor por grupo", mas isso é política e precisa de teste que a imponha (por exemplo, a função de análise devolver apenas os escores por grupo agregados entre grupos, nunca contagens por grupo).

**O que eu mudaria (sem implementar):**

* Piso maior de participantes distintos no grupo-ciclo (5 ou mais) para liberar contagens por dívida completas; abaixo disso, liberar só o total.
* Regra do participante dominante: nenhum participante com mais de 50% dos SED do grupo-ciclo; caso contrário suprimir.
* Processar a análise no servidor e liberar apenas estatísticas entre grupos de pelo menos 10 grupos por cliente.
* Arredondamento ou ruído: mede-se o custo em poder (40 grupos, 18 meses, 8 SED, RR pico 2): sem ruído 79%; arredondar para múltiplo de 3, 50%; Laplace com escala 1 por contagem, 28%; escala 2, 10%; múltiplo de 5, 23%. Em RR pico 3: 99%, 83%, 40%, 11%, 45%. Ou seja, ruído por contagem é caro; vale mais restringir o canal do que perturbar (nota: o ruído por contagem é uma das formas; ruído aplicado só ao escore agregado teria custo menor, não medido).
* Definir quem tem acesso por papel e registrar log de consulta; revisão jurídica antes de qualquer execução (o documento já lista).

## 9. Pergunta H: texto versus números

| Passagem do documento | Arquivo | Resultado |
|---|---|---|
| Seção 5, tabela de erro tipo I (9 linhas, ingênuo e direcional) | `fase2_dir.jsonl`, `fase2_dir2.jsonl` | Confere linha a linha |
| "O direcional ficou entre 3,9% e 7,0% em todos os cenários" | `fase2_controle.jsonl` | **Diverge**: o teste primário rejeitou 7,5% [5,7; 9,9] no cenário base (600 simulações). Também 7,0% (soma, tendência) está em `fase2_dir2` e é a variante rejeitada. O intervalo citado cobre só as execuções escolhidas |
| "Calibrado em 10 cenários não independentes" | `fase2_fp.jsonl`, `fase2_fp.mjs` | **Diverge no rótulo**: `fase2_fp.jsonl` tem 17 cenários, mas o estimador rodado é o NÃO direcional (`componentes` sem avanço). A coluna "primario_participacao" não é o primário. Os 6 cenários do direcional no `fase2_dir` e 3 de causa comum no `fase2_dir2` dão 9 cenários nulos além do base. Faltam para o direcional G pequeno, 2 SED, grupos desiguais, sazonalidade, T curto |
| "O intervalo cobre zero em 91% a 93%" | `fase2_dir.jsonl` | Confere (91,4 a 92,9) |
| "Poder, 10 células da seção 6" | `fase2_poder.txt` | Confere nas 10 linhas e 30 números; mais 12 células minhas que concordam |
| "Com a supressão por célula: 10%, 21% e 33%" | `fase2_poder.txt` (40, 12, 8, células) | Confere |
| "Controle rejeita 5% a 6% (600 simulações)" | `fase2_controle.jsonl` | Faixa real: 4,7% a 6,3% nos 6 cenários nulos; o primário nessas mesmas execuções chega a 7,5% |
| "Sob efeito real nos pares da matriz o controle rejeita em 0%" | `fase2_controle.jsonl` | Confere (0,0% em RR 3 com 20 e 60 grupos), mas o sinal é negativo (seção 6 acima) |
| "Liberação agregada ... no mínimo 3 participantes distintos" | `estimador.mjs` linhas 103 a 111 (`liberarGrupoMes`) | **Diverge**: a simulação usa 3 SED no grupo-mês como proxy de 3 participantes distintos. O SQL usa 3 participantes distintos no ciclo. Para grupos com 4 a 8 SED e poucos participantes o mês seria suprimido na prática; a simulação é otimista |
| Seção 4: "intervalo por inversão do mesmo teste" | `estimador.mjs` linha 3 | Comentário do cabeçalho diz "IC por jackknife de grupos"; o código implementa inversão (Fieller). Comentário velho |
| Seção 7: nível 3 sem efeito mínimo | Seção 4 diz que o limiar será congelado | Ausente do critério do nível 3 |
| Seção 3: "52 testes, nenhuma falha" | não executável aqui | Não verificado |
| Seção 5: "A calibração da família de 3 testes por classe não foi refeita para o direcional" | `fase2_fp.jsonl` coluna `tres_classes_bonferroni` | Honesto; a coluna existente é do estimador ingênuo |

## 10. Pergunta I: notas por categoria

| # | Categoria | Rodada 1 | Rodada 2 | Justificativa |
|---|---|---|---|---|
| 1 | Validade do desenho | 4 | 6 | Exposição por A, IEC retirado, direcional elimina a causa comum persistente reversível. Falta: precedência calendária e transitórios iniciais continuam confundindo; "confirmado" ainda sugere mais do que o desenho identifica |
| 2 | Controle de erro tipo I | 4 | 6 | 5,0% a 6,5% em 30 cenários adversos, com meu código e meus cenários. Excesso de 0,5 a 1 ponto, G de 10 ou menos 6,4%, e falha em transitório (9% a 19%), ciclo de grupo (até 58%), atraso (até 21%); IC subcobre; família de classes não calibrada |
| 3 | Poder e dimensionamento | 3 | 5 | Tabela honesta, RR de pico declarado, tamanho adiado para a fase 1, 36 de 36 números reproduzidos. Favorece o estimador (degrau 41%, efeito rápido 38%); tamanho ainda não fixado |
| 4 | Modelo de dados da simulação | 3 | 5 | Passou a ter persistência, causa comum, choque, tendência. Faltam transitório, participante repetido, supressão por participante distinto, efeito em degrau no teto da tabela |
| 5 | Critério de promoção | 4 | 5 | Itens quebrados retirados; probabilidade conjunta aceitável (cerca de 66% a 70%). Faltam efeito mínimo, definição de peso, regra de qual cliente no nível 1; regra de 50% mata o nível 3 por desenho; controle invalida 16% a 21% de métodos válidos |
| 6 | Medidas de efeito e intervalos | 3 | 4 | Estimador e IC existem. Beta não tem unidade interpretável (subestima cerca de 55%), sem RR; Fieller subcobre por causa do t; sem threshold |
| 7 | Qualidade de dados | 3 | 4 | A porta passa a incluir validação humana; a liberação resolve o poder. Kappa continua sendo confiabilidade; deriva sem número; privacidade por grupo mais fraca |
| 8 | Reprodutibilidade e implementação | 6 | 7 | Código, resultados brutos e tabela reproduzíveis; núcleo reaproveitado. `fase2_fp` rotulado como primário, faixa 3,9 a 7,0 contradita, comentário velho, teste SQL não executável aqui, sem teste unitário do simulador |
| 9 | Risco ético e de decisão | 6 | 5 | Rebaixada: a v2 libera contagens por dívida por grupo com piso de 3 participantes, sem regra de dominância, no papel que também serve o painel. Atenuante: uso interno, nível 4 separado, jurídico listado |
| 10 | Clareza e completude | 6 | 7 | A tabela do que mudou e as pendências são claras. Falta efeito mínimo no critério, definição de peso e de beta |

Média: rodada 1 = 4,2; rodada 2 = 5,4.

## 11. VEREDITO

**VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO**

O método v2 é um instrumento exploratório sólido, bem calibrado nos cenários reversíveis, e o autor tratou com honestidade os limites que declarou. Não é base para confirmação porque (a) a calibração falha em famílias de ruído com direção temporal, plausíveis em piloto; (b) o poder está no teto sob o modelo de efeito mais favorável; (c) o nível 3 não tem efeito mínimo nem estimador interpretável; (d) o canal de dados é eticamente mais fraco que na v1 e depende de política.

**O que ainda falta para o nível 3:**

1. Efeito mínimo de interesse definido numa unidade interpretável (RR ou variação padronizada com mapa para o beta), congelado por hash.
2. Calibração do direcional com transitório inicial, ciclos de grupo e atraso; descartar o primeiro mês ou dois (burn in) e testar o descarte; relatar a sensibilidade.
3. Poder sob efeito em degrau, efeito rápido, erro do classificador (kappa medido) e persistência de A, com o tamanho da fase 2 ditado pelo cenário mais conservador.
4. Intervalo corrigido (jackknife por grupo ou bootstrap studentizado) com cobertura validada.
5. Definição de peso na regra de 50%, do cliente de nível 1 (ou correção para 3 olhares), e critério de nível 2 com significância.
6. Calibração das 3 classes de prazo e do pooled para o direcional.
7. Revisão do controle: bilateral ou com contraste informativo; aceitar que matriz incompleta aparece como rejeição do controle e tratá-la como achado.
8. Matriz conferida contra o Documento 1 inteiro; kappa medido contra humanos; mês a mês verificado que 3 SED são 3 participantes distintos.
9. Replicação em 3 clientes reais, análise congelada, com cuidado de que causas estruturais comuns não se replicam como evidência.
10. Revisão por estatístico externo e ata (já previstas).

**O que ainda falta para o nível 4:** tudo do nível 3, mais: duas apurações semestrais consecutivas, teste de compreensão com RH, revisão ética e jurídica da linguagem, e uma decisão explícita de que um achado "A antecede B" não será apresentado como "A converte em B". Também: privacidade com piso e dominância, canal que impeça por construção a saída de contagens por grupo, e custo de erro tratado (um falso positivo exibido a RH pode induzir ação sobre pessoas).

**Grau de confiança:** moderado a alto (cerca de 75%) de que o excesso de inflação aparece nas três famílias com direção temporal e de que o poder é um teto; moderado (cerca de 60%) nas magnitudes, porque dependem de cenários que eu inventei. Alto (90%) de que os números do documento batem com os arquivos, exceto as divergências listadas.

**O que não consegui verificar:**

* O teste SQL com PostgreSQL (não há servidor aqui); a revisão do SQL foi só por leitura.
* A frequência real de transitórios, ciclos e atrasos; o volume e a distribuição real por participante.
* A matriz completa de adjacência e a decisão C dos documentos originais.
* A calibração do direcional para a família de 3 classes de prazo, o efeito de erro de classificação sobre ele, e o limiar de efeito (ainda inexistente).
* O efeito de participante repetido (clusterização por pessoa), que aumentaria a dependência entre meses dentro do grupo.
* A probabilidade conjunta do nível 3 incluindo todos os itens não estatísticos (revisão, ata, porta de qualidade).

Código e resultados: `auditoria_externa/rodada2/` (`r2_lib.mjs` implementação e gerador próprios; `r2_fp.mjs`, `r2_mundos.mjs`, `r2_poder.mjs`, `r2_cobertura.mjs`, `r2_signflip.mjs`, `r2_controle.mjs`, `r2_niveis.mjs`, `r2_privacidade.mjs`; `nucleo.mjs` e `estimador.mjs` são cópias literais dos arquivos do repositório).
