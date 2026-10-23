# Auditoria estatística externa do método de adjacência

Auditor externo e independente. Alvo: `METODO_ADJACENCIA.md`, `lib/review/sim/power2.mjs` (e `power.mjs`, `power_global.mjs`), `lib/review/src/engine/adjacency.ts`, mais `schema.sql`, `contract.ts` e `iec.ts` quando uma afirmação dependia deles. Nada do repositório foi alterado além deste relatório e da pasta `auditoria_externa/`. Nenhuma rede, API paga ou Google Drive foi usada.

Convenções: IC95 de Wilson entre colchetes; "n" é o número de simulações Monte Carlo; os números "meus" vêm de código escrito do zero (`auditoria_externa/core.mjs`), não do `power2.mjs`. O que não foi medido está dito como tal.

## 1. Resumo executivo

1. A tabela de poder do documento **reproduz exatamente** ao rodar o `power2.mjs` (9 de 9 células de RR 1,5 e 9 de 9 de RR 2,0 idênticas ao texto) e **reproduz dentro do erro Monte Carlo** no meu código independente (a pior célula é 10 grupos, 12 meses, 16 SED: 67% contra 75%, cerca de 2 erros padrão). O cálculo está correto **dentro do mundo simulado**.
2. Esse mundo é benigno demais. Meses trocáveis, dívidas equiprováveis, sem autocorrelação, sem tendência, sem sazonalidade, grupos independentes, classificador que sorteia o adjacente ao acaso, e **dados sem a supressão de 3 participantes por célula que o próprio banco aplica**. Fora dele, o falso positivo sobe a 7 a 20% (tendência comum, autocorrelação, choque mensal comum, classificador circular), e com a supressão do banco o poder cai para o nível do acaso.
3. O "RR 1,5" da tabela é o pico do efeito, não o efeito médio. No gerador do próprio documento o RR médio efetivo sobre os grupos e meses é cerca de 1,16 quando o nominal é 1,5.
4. Vários itens do critério de promoção são **inalcançáveis ou vazios** no tamanho de piloto proposto (Brier: 7 a 11% de chance de passar com RR 1,5; placebo de tempo: tautológico; controle negativo com 60 pares: reprova um método válido de 7% a 99% das vezes conforme o cenário).
5. Veredito: **VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO** (seção 10).

## 2. Notas por categoria

| # | Categoria | Nota (0 a 10) | Síntese |
|---|---|---|---|
| 1 | Validade do desenho | 4 | Circularidade reconhecida, mas desfechos não são independentes e a simulação nula não a reproduz |
| 2 | Controle de erro tipo I | 4 | Calibrado só sob meses trocáveis; falha sob tendência, autocorrelação, choque comum e classificador circular |
| 3 | Poder e dimensionamento | 3 | Conta correta, premissas otimistas, RR nominal confundido com RR efetivo, supressão ignorada |
| 4 | Modelo de dados da simulação | 3 | Poisson iid, dívidas equiprováveis, grupos independentes, sem supressão |
| 5 | Critério de promoção | 4 | Boa arquitetura em níveis, mas critérios incoerentes entre si e dois vazios |
| 6 | Medidas de efeito e intervalos | 3 | Não existe estimador de RR nem IC no código; o texto cita modelo que não foi implementado |
| 7 | Qualidade de dados | 3 | Regra de 3 participantes destrói os dados; kappa 0,61 mede confiabilidade, não validade |
| 8 | Reprodutibilidade e implementação | 6 | Determinístico e reproduzível; há divergências texto e código e partes do método não implementadas |
| 9 | Risco ético e de decisão | 6 | Uso interno e portões em níveis são bons; falta custo explícito de erro e proteção de grupos pequenos |
| 10 | Clareza e completude | 6 | Legível e honesto sobre premissas; etapas 2, 3, 5 e 6 ficaram obsoletas diante do que foi simulado |

Média simples: 4,2.

## 3. Verificações obrigatórias executadas

### 3.1 Reprodução do que o documento afirma

| Afirmação do documento | O que medi | Situação |
|---|---|---|
| Tabela de poder, 9 linhas, RR 1,5 e 2,0 (linhas 62 a 70) | `power2.mjs 120` completo (27 cenários), arquivo `resultados/orig_grid120.txt`: 23/50, 48/80, 65/97, 74/98, 91/100, 75/97, 82/100, 90/100, 85/100 | Idêntico ao texto (o script é determinístico) |
| "Falso positivo médio de 4,4% nos 27 cenários" (linha 51) | Média dos 27 valores "FP perm" da mesma execução: **4,77%**, mínimo 0,0%, máximo 10,0% (cenário 20 grupos, 6 meses, 4 SED) | **Não bate** (4,4 vs 4,8). Diferença pequena, mas o número do texto não vem desta versão do script |
| "Erro de amostragem de cerca de 4 pontos percentuais por célula" (linha 51) | Meia largura do IC95 com 120 simulações e p = 0,05 é 3,9 pontos | Correto para o falso positivo. Para o poder perto de 50% a meia largura é 8,9 pontos e a tabela não mostra IC |
| "10 grupos, 12 meses, 8 SED: de 83% para 65%" (linha 72) | `power_global.mjs` (uma célula, 600 sim.): 80%; `power2`: 65% (meu código, 600 sim.: 70% [66; 74]) | Consistente dentro do erro |
| "16 SED por grupo e mês bastam 20 grupos por 9 meses (82%)" (linha 72) | Meu código, 600 sim.: **78% [75; 81]**; com 300 sim.: 74% [68; 78] | O 80% não é demonstrado: o IC inclui valores abaixo de 80 |
| "10 grupos por 12 meses se o volume real passar de 16 SED" (linha 105) | A própria tabela (linha 67) dá 75% para essa célula; meu código: **67% [63; 70]** | **Contradiz o alvo de 80%** que o texto adota |
| "RR 1,5 é o menor efeito que 20 grupos por 12 meses detecta com 90%" (linha 91) | Meu código: 91% [89; 93] com RR **nominal** 1,5 | Verdadeiro só para o nominal. RR efetivo médio ≈ 1,16 (ver 3.3) |

### 3.2 Calibração do erro tipo I (hipótese nula verdadeira, sem conversão)

Meu gerador e meu teste (estatística de escore com exposição acumulada, permutação da ordem dos meses por grupo, B = 199, nível 5%, unilateral). n = 2000 por cenário; G = 10, T = 12, 8 SED por grupo e mês, salvo indicação. Arquivo `resultados/fp_all_2000.jsonl` e `fp_choque.jsonl`.

| Cenário nulo | Teste global (documento) rejeita, % [IC95] | Família de 3 testes por prazo, Bonferroni, % [IC95] |
|---|---|---|
| Base (Poisson iid, dívidas equiprováveis) | 4,7 [3,9; 5,7] | 4,8 [4,0; 5,9] |
| Poucos SED: 2 por grupo e mês | 4,9 [4,0; 5,9] | 4,6 [3,8; 5,6] |
| Poucos SED: 4 por grupo e mês | 4,5 [3,6; 5,4] | 4,3 [3,5; 5,3] |
| 20 grupos | 5,6 [4,7; 6,7] | 5,0 [4,1; 6,0] |
| Sobredispersão do volume entre meses (gama, forma 2) | 4,8 [4,0; 5,9] | 5,3 [4,4; 6,3] |
| Sobredispersão da composição entre meses | 5,2 [4,3; 6,3] | 4,1 [3,3; 5,1] |
| Grupos muito desiguais (dp log 1,0) | 4,6 [3,8; 5,6] | 4,3 [3,5; 5,3] |
| Dívidas com participações muito diferentes | 5,5 [4,5; 6,5] | 4,5 [3,7; 5,6] |
| **Autocorrelação AR(1) 0,6 da composição do grupo** | **8,6 [7,4; 9,9]** | **8,7 [7,5; 10,0]** |
| **Autocorrelação AR(1) 0,9** | **6,8 [5,8; 8,0]** | **7,3 [6,3; 8,6]** |
| **Tendência comum a todos os grupos (±8% ao mês por dívida)** | **11,1 [9,7; 12,5]** | **23,3 [21,5; 25,2]** |
| **Tendência comum forte (±15% ao mês)** | **20,1 [18,4; 21,9]** | **44,6 [42,5; 46,8]** |
| Sazonalidade comum (período 6 meses) | 5,8 [4,9; 6,9] | 7,2 [6,1; 8,4] |
| **Choque mensal comum a todos os grupos do cliente (10 grupos)** | **8,1 [6,9; 9,6]** (n = 1500) | **9,9 [8,5; 11,5]** |
| **Choque mensal comum, 20 grupos** | **10,4 [9,0; 12,0]** | **16,1 [14,4; 18,1]** |
| Classificador circular sem persistência (controle) | 5,4 [4,5; 6,5] | 4,3 [3,5; 5,2] |
| **Classificador circular com persistência (AR 0,8)** | **7,5 [6,4; 8,7]** | **10,4 [9,2; 11,9]** |
| Classificador circular fraco com persistência | 5,8 [4,9; 7,0] | 6,0 [5,0; 7,1] |

Leitura:

* Sob exatamente o que o documento supõe (meses trocáveis), a permutação **está calibrada**: 4,3% a 5,6%, com todos os ICs contendo 5%. Isso confirma o achado do autor. O teste de 3 classes por Bonferroni também mantém 5% nesses cenários, e o mínimo dos 3 p valores com permutação conjunta (Westfall Young) dá 5,3% [4,2; 6,5] no cenário base.
* A calibração **quebra** quando os meses deixam de ser trocáveis. A hipótese que a permutação testa é "meses trocáveis dentro do grupo", mais forte do que "não há conversão". Tendência, autocorrelação e choques do cliente violam a primeira sem violar a segunda.
* A família de 3 classes sofre mais do que o teste global (23% a 45% sob tendência) porque cada classe soma exposições em janelas diferentes e a tendência alinha uma delas por acaso.
* Parte do problema é mecânico: a exposição acumulada tem menos defasagens disponíveis nos meses iniciais (rampa de 0 a 6 meses), o que correlaciona a exposição com qualquer tendência. Normalizar a exposição pelo número de defasagens disponíveis reduz o excesso (tendência de 13,6% para 8,3%; forte de 20,9% para 12,2%; AR 0,6 de 7,0% para 5,9%, n = 1000, `resultados/janela.txt`), mas não o elimina.
* O documento só testou a calibração em cenários de Poisson iid (27 cenários, 120 simulações). A execução `power2.mjs 300 fp` do repositório usa só 5 configurações, todas iid.

### 3.3 Poder: reprodução com código próprio

Meu código, nível 5%, B = 199, n = 600 por célula, premissas do documento (efeito em rampa, 70% dos SED com adjacência, heterogeneidade de grupo equivalente). `resultados/pow_tabela.txt`.

| Grupos | Meses | SED por grupo e mês | RR nominal | Poder do documento | Meu poder [IC95] | RR efetivo médio (meu gerador) |
|---|---|---|---|---|---|---|
| 10 | 6 | 8 | 1,5 | 23% | 25% [22; 29] | 1,07 |
| 10 | 9 | 8 | 1,5 | 48% | 42% [38; 46] | 1,13 |
| 10 | 12 | 8 | 1,5 | 65% | 70% [66; 74] | 1,16 |
| 20 | 9 | 8 | 1,5 | 74% | 70% [66; 74] | 1,13 |
| 20 | 12 | 8 | 1,5 | 91% | 91% [89; 93] | 1,16 |
| 10 | 12 | 16 | 1,5 | 75% | 67% [63; 70] | 1,26 |
| 20 | 9 | 16 | 1,5 | 82% | 78% [75; 81] | 1,22 |
| 40 | 9 | 8 | 1,5 | 90% | 91% [88; 93] | 1,13 |
| 10 | 12 | 8 | 2,0 | 97% | 96% [94; 97] | 1,31 |
| 20 | 12 | 8 | 2,0 | 100% | 100% [99; 100] | 1,31 |

Conclusão: a tabela está **correta como cálculo**. Duas ressalvas. (a) O RR efetivo é muito menor que o nominal porque a lei do efeito é `RR elevado a min(1, exposição/3)` (`power2.mjs` linha 30): só o pico atinge o RR nominal. O documento apresenta "RR 1,5" como se fosse o efeito que o piloto detecta; o que ele detecta é um efeito cujo pico é 1,5 e cuja média é cerca de 1,16. (b) Se o RR for tomado como constante quando há exposição na janela (efeito em degrau, RR efetivo 1,31), o poder de 20 grupos por 12 meses cai de 91% para **60% [55; 66]** (`pow_dimstep.txt`).

### 3.4 Poder por classe de prazo (3 testes, Bonferroni 3), 12 meses, 8 SED

Efeito presente nas 3 classes. `resultados/pow_classes.txt`.

| Grupos | RR | Global | Ao menos uma classe | Imediata | Curta | Média |
|---|---|---|---|---|---|---|
| 10 | 1,5 | 70% | 37% | 13% | 19% | 9% |
| 20 | 1,5 | 91% | 63% | 29% | 35% | 16% |
| 40 | 1,5 | 100% | 90% | 51% | 66% | 29% |
| 20 | 2,0 | 100% | 98% | 70% | 81% | 40% |

O status por classe (a unidade que o documento propõe exibir, linha 99) tem poder muito menor que o teste global: 16% a 35% por classe com 20 grupos e RR 1,5. A classe "média" (4 a 6 meses) fica com 6 a 8 meses de janela completa em 12 meses.

Além disso, as janelas de exposição das três classes **terminam todas em 6 meses** (`power2.mjs` linha 41), logo se sobrepõem. O teste verifica "A antecede B em até 6 meses", não "A vira B no prazo da matriz". O prazo (imediata, curto, médio) nunca é validado por ele.

### 3.5 Permutação de meses: o que ela quebra

* Preserva, por construção, o vínculo entre par e desfecho do mesmo mês (volume compartilhado). Isso evita o defeito do primeiro desenho. Boa decisão.
* Destrói autocorrelação, tendência e sazonalidade. Resultado: falso positivo de 6,8% a 8,6% com autocorrelação, 11% a 20% com tendência, 8% a 10% com choque comum (seção 3.2). Reduz o poder? Não medi perda de poder pela permutação em si. Medi que, sob o efeito real, rejeita 90,6% (meu código, 20 grupos, RR 1,5) contra 95,8% do teste t por escores de grupo com remoção do efeito de mês.
* O deslocamento circular de meses, a alternativa óbvia, é **pior**: 12% a 26% de falso positivo mesmo no cenário iid (`shift_circ`). Confirma por que o autor o descartou (o texto cita 28%).
* A alternativa que se saiu melhor: escore por grupo, com o efeito de mês removido (desfecho e exposição centrados pela média entre grupos no mesmo mês), seguido de teste t unilateral com G menos 1 graus de liberdade sobre os escores dos grupos. Falso positivo de 4,3% a 7,0% em tendência (7,0% [6,0; 8,2]), tendência forte (6,7%), autocorrelação (4,3% e 1,4%), choque comum (6,5% e 5,6%) e sazonalidade (5,5%); no cenário base 5,7% [4,8; 6,8]. Poder igual ao da permutação na DGP do documento (95,8% contra 90,6%). Limite: sob classificador circular com persistência rejeita 49,5% a 76,2%, o que é uma virtude (mostra a confusão) e um alerta (o dado nulo está confundido).
* A variante "desfecho como mudança em relação aos 2 meses anteriores" introduz autocorrelação negativa e **infla o erro** (14% a 24%); não usar.

### 3.6 Circularidade: o desfecho é independente do classificador?

Verificação em três partes.

**(a) No gerador do próprio documento.** `power2.mjs` linha 33 sorteia o adjacente **uniformemente entre os 3** e independentemente de tudo. Portanto a simulação nula **não reproduz** a circularidade que o texto diz reproduzir (linha 19, "a adjacência é sorteada da matriz, reproduzindo a circularidade"). Sorteio uniforme é o caso em que o classificador não sabe nada. O risco real é o oposto: o classificador lê o mesmo texto que produz a dívida principal e escolhe o adjacente a partir do que já está presente.

**(b) Simulação de confusão.** Cenário em que, sem nenhuma conversão, o adjacente escolhido é o candidato com maior peso latente no mês e esse peso é persistente (AR 0,8). Resultado (G = 20, 8 SED, n = 500, `resultados/variantes.txt`): teste do documento rejeita 4,8% a 6,8%, mas o teste t com efeito de mês removido rejeita **76,2% [72,3; 79,7]** com circularidade forte e 17,6% com circularidade fraca. Sem persistência, a circularidade é inofensiva (5,4%). A confusão exige persistência da situação, que é o caso normal em RH (a mesma situação continua sendo relatada de um mês para o outro, e muitas vezes pelo mesmo participante).

**(c) Remédio verificado.** Usar como exposição a **contagem de A como dívida principal** (que não depende da escolha do classificador) em vez dos pares rotulados: falso positivo 0,2% a 0,6% sob circularidade (teste t por grupo). O preço é poder menor se o efeito ocorrer apenas nos SED rotulados com a adjacência (40% contra 96% em RR 1,5), mas maior se o efeito depender de A e não do rótulo (54% a 67% contra 20% a 37%). Ou seja, o teste do documento mede "A antecede B", pouco do que o classificador sabe sobre adjacência; a contagem de A é a exposição certa para essa pergunta.

**(d) Os três desfechos "independentes" (linhas 9 a 11).**

| Desfecho | Independente do classificador? |
|---|---|
| 1. B aparece como principal depois | Não: mesmo classificador (provavelmente o mesmo modelo) e mesmo texto geram principal e adjacente; erros são correlacionados |
| 2. Respostas da pesquisa silenciosa de B pioram | Sim em origem, mas **não há simulação nem teste** para ele; não está nos critérios de promoção |
| 3. IEC de B sobe depois | **Não**: `iec.ts` linhas 39 e 65 multiplicam o IEC por `1 + 0,15 vezes a soma dos IEC adjacentes ativos`. O IEC de B contém, por fórmula, o IEC das adjacentes. Subida de A empurra B mecanicamente. Circular por construção |

Também: 14 dos 30 pares da matriz têm recíproco (por exemplo D9 para D10 e D10 para D9; D4 para D2 e D2 para D4; D6, D7, D8 formam ciclo). A direção temporal "A antes de B" não é identificável apenas por precedência quando B também aponta para A.

### 3.7 Três testes por classe de prazo

* Erro familiar: Bonferroni 3 mantém 4,1% a 5,3% sob meses trocáveis (tabela 3.2). O documento diz "correção para 3" sem dizer qual; o código do repositório **não implementa** esse teste (nem `power2.mjs` nem `adjacency.ts`).
* Poder: perde de 91% (global) para 63% (ao menos uma classe) e 16% a 35% por classe (tabela 3.4), com 20 grupos e RR 1,5.
* Sob tendência o erro familiar dispara (23% a 45%).

### 3.8 Dimensionamento próprio

Teste global (permutação, 5%), efeito em rampa como no documento, n = 300, `resultados/pow_dim.txt`. Para cada combinação mostro o menor número de grupos testado que atinge a meta.

| SED por grupo e mês | Meses | RR 1,5, 80% | RR 1,5, 90% | RR 2,0, 80% | RR 2,0, 90% |
|---|---|---|---|---|---|
| 4 | 9 | mais de 60 (60 grupos dá 72%) | mais de 60 | cerca de 22 (20 dá 77%, 30 dá 88%) | cerca de 35 (40 dá 94%) |
| 4 | 12 | cerca de 35 (30 dá 76%, 40 dá 87%) | cerca de 45 a 50 (60 dá 94%) | 10 a 15 (10 dá 76%, 15 dá 92%) | 15 |
| 4 | 18 | cerca de 17 (15 dá 74%, 20 dá 87%) | cerca de 25 (30 dá 95%) | 10 (94%) | 10 a 15 |
| 8 | 9 | 30 (80%) | 40 (90%) | 10 (82%) | 15 (96%) |
| 8 | 12 | cerca de 16 (15 dá 78%, 20 dá 90%) | 20 | 10 (95%) | 10 |
| 8 | 18 | 10 (90%) | 10 | 10 | 10 |
| 16 | 9 | cerca de 25 (20 dá 74%, 30 dá 92%) | 30 | 10 (85%) | 15 (94%) |
| 16 | 12 | cerca de 13 (10 dá 67%, 15 dá 82%) | 20 | 10 (94%) | 10 |
| 16 | 18 | 10 (85%) | 15 | 10 | 10 |

(Grade completa em `resultados/pow_dim.txt`, n = 300 por célula, meia largura do IC95 de 3 a 6 pontos. Os "cerca de" são interpolações minhas entre os pontos simulados.)

Com efeito em **degrau** (RR constante quando há exposição, RR efetivo médio 1,31 para nominal 1,5; 8 SED, 12 meses, `pow_dimstep.txt`): 80% exige cerca de 32 grupos (30 dá 77%) e 90% cerca de 40 a 45 (40 dá 88%, 60 dá 97%). Com 18 meses: 20 grupos dá 76%, 30 dá 92%. Para RR nominal 2,0: 10 grupos por 12 meses dá 73%; 20 dá 91%.

Resposta ao piloto proposto:

* 10 grupos por 12 meses: suficiente só para RR 2,0 no cenário benigno (95% a 97%), insuficiente para RR 1,5 (65% a 71%).
* 20 grupos por 12 meses com 8 SED por grupo e mês: suficiente (90% a 91%) **somente** sob todas as premissas do documento e com RR nominal (pico) 1,5. Insuficiente no cenário em degrau (60%), com classificador de kappa em torno de 0,61 (ver 3.9), com tendência (o erro tipo I deixa de valer 5%) e, sobretudo, com a supressão de células (ver 3.10).

### 3.9 Sensibilidade a erro de classificação (kappa 0,61)

Cada SED troca de dívida principal, ao acaso, com probabilidade q (o par vai junto). 20 grupos, 12 meses, 8 SED, n = 300, `resultados/diag_misclass.txt`.

| q | kappa aproximado contra a verdade (dez dívidas equiprováveis) | Poder RR 1,5 | Poder RR 2,0 |
|---|---|---|---|
| 0 | 1,00 | 88% [84; 91] | 100% |
| 0,15 | 0,83 | 71% [66; 76] | 98% |
| 0,30 | 0,67 | 49% [43; 55] | 80% [75; 84] |
| 0,45 | 0,50 | 23% [18; 28] | 47% [41; 53] |

Um kappa de 0,61 entre repetições corresponde a erro individual em torno de 0,2 se os dois lados erram de modo independente, o que implica poder de cerca de 60% a 65% com RR 1,5. A conta kappa para q é uma aproximação minha (prevalências iguais), não medida. O piloto não foi dimensionado com essa perda.

### 3.10 Supressão de células pelo banco (achado mais grave)

`schema.sql` linhas 170 e 185: `sed_release()` e `adjacency_release()` só devolvem uma linha de agregado se `count(DISTINCT contributor_token) >= 3` **por célula** (grupo, ciclo, principal, momento) e (grupo, ciclo, principal, adjacente). O texto diz (linha 28) que a análise usará "apenas agregados já suprimidos". Com 8 SED por grupo e mês espalhados em 10 dívidas e 30 pares, a célula típica tem 0 ou 1 SED. Conta direta (melhor caso, cada SED de um participante distinto, e sem a divisão adicional por `momento` em 5 categorias que `sed_release` faz):

| SED por grupo e mês | Eventos de pares que sobrevivem à supressão | Eventos de principal por dívida que sobrevivem |
|---|---|---|
| 4 | 0,4% | 6% |
| 8 | 1,5% | 19% |
| 16 | 5,5% | 48% |
| 40 | 24% | 91% |
| 100 | 68% | 100% |

Poder com as células suprimidas tratadas como ausentes (n = 300, 12 meses, `resultados/pow_supressao.txt`):

| Grupos | SED por grupo e mês | Rejeição sob RR 1,0 | RR 1,5 | RR 2,0 |
|---|---|---|---|---|
| 10 | 8 | 4% | 5% | 8% |
| 20 | 8 | 4% | 5% | 11% |
| 20 | 16 | 8% | 18% | 25% |
| 20 | 40 | não rodado | 27% | 47% |
| 20 | 100 | 5% | 11% | 30% |
| 10 | 100 | 7% | 12% | 19% |

(Dado que eu tratei célula suprimida como zero e não como dado faltante informativo, há também viés; o ponto central é que o poder desaparece, não o valor exato.) Em outras palavras: **se a análise consumir somente as funções de publicação do banco, o piloto de 20 grupos por 12 meses não tem poder algum**, qualquer que seja o método. Se a análise puder ler eventos brutos (decisão de privacidade distinta), a simulação se aplica, mas isso contradiz a linha 28.

### 3.11 Controle negativo, placebo e Brier

**Controle negativo com 60 pares** (critério 6, linha 94). O banco só devolve adjacentes que o classificador escolheu; `contract.ts` linhas 95 a 99 não impõe a matriz, mas o texto diz que os adjacentes saem da matriz. Para os 60 pares fora da matriz, exposição "par rotulado" não existe ou é rara; usei a contagem de A como principal. O número de descobertas entre 60 testes **não é Binomial(60; 0,05)** porque os testes compartilham desfechos e exposições (variância observada de 4,8 contra 2,85 teórica no cenário iid). Probabilidade de o critério (reprovar com 7 ou mais descobertas) reprovar um método **válido** (n = 200, `diag_neg.txt`):

| Cenário nulo | Média de descobertas em 60 | P(7 ou mais) | P(9 ou mais) |
|---|---|---|---|
| iid | 3,0 | 7,5% [4,6; 12,0] (binomial exata: 3,0%) | 3,5% |
| AR(1) 0,8 | 5,0 | 23,0% [17,7; 29,3] | 9,0% |
| Tendência comum | 16,0 | 99,0% [96,4; 99,7] | 97,0% |

Ou seja, o controle negativo reprova métodos válidos sob qualquer não estacionariedade, e o texto ("tolerância de teste binomial") não diz qual tolerância. Também não tem poder para detectar um método inválido em que o viés é pequeno.

**Placebo de tempo (critério 7, linha 95)**: "com a ordem dos meses embaralhada o sinal desaparece". Isso é a própria definição da distribuição de referência da permutação; passa sempre que o código não tem bug e nada diz sobre confusão. Tautológico. A versão informativa é o **placebo de antecedência** (usar exposição futura para explicar desfecho passado; série invertida). Medido (G = 20, n = 300, `diag_placebo.txt`): sob efeito real rejeita 0,3% (bom); sob tendência rejeita 17,3% e sob autocorrelação 7,0%, ou seja, detecta a não estacionariedade, mas só em parte dos casos; não detecta a circularidade (5,3%). Útil como diagnóstico, não como prova.

**Brier fora da amostra (critério 5, linha 93)**: separei os grupos em metades (treino e teste), previ "B aparece como principal no mês" com a taxa do próprio B com e sem a exposição, IC95 t dos ganhos por grupo de teste. Probabilidade de o IC do ganho ficar acima de zero (n = 120, `diag_brier.txt`):

| Grupos | RR nominal | P(IC95 do ganho > 0) |
|---|---|---|
| 20 | 1,0 | 0,0% (correto) |
| 20 | 1,5 | 7,5% [4,0; 13,6] |
| 40 | 1,5 | 10,8% [6,4; 17,7] |
| 20 | 2,0 | 23,3% [16,7; 31,7] |
| 40 | 2,0 | 42,5% [34,0; 51,4] |

Mesmo com 40 grupos e efeito dobrado, o critério passa menos da metade das vezes. Como o critério 5 é conjuntivo com os demais, **a probabilidade conjunta de alcançar o nível 3 com o efeito mínimo de interesse é limitada por cerca de 10%**, independentemente da potência de 91% do teste global. O critério é, na prática, inatingível no tamanho de piloto.

**Dois de três clientes com mesmo sentido (critério 4)**: sob a nula a probabilidade de 2 ou mais de 3 clientes com sinal positivo é 50% (conta direta). Critério de sinal quase não filtra falso positivo.

## 4. Achados por categoria

Legenda de classes: **MUITO BOM (manter)**, **AJUSTAR**, **MELHORAR (acrescentar)**, **DELETAR (remover ou descartar)**. Severidades: crítico, alto, médio, baixo.

### 4.1 Validade do desenho (nota 4)

Justificativa: o texto identifica a circularidade e propõe corretamente que a prova venha de dado independente do rótulo, mas os três desfechos não são independentes (3.6), a simulação nula não a reproduz, e o desenho não impede a confusão por persistência da situação.

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Diagnosticar a circularidade como problema central (METODO linhas 5 a 11) | MUITO BOM (manter) | n/a | Correto e raro; manter |
| Linguagem "o par antecede B, não A causa B" (linha 29) | MUITO BOM (manter) | n/a | Mantém a associação separada de causa |
| Desfecho 3 "IEC de B sobe" | DELETAR (remover ou descartar) | alto | `iec.ts` linhas 39 e 65: IEC de B inclui o IEC das adjacentes; circular por fórmula |
| Desfecho 1 "B aparece como principal" apresentado como independente | AJUSTAR | alto | Mesmo classificador e mesmo texto; usar exposição por contagem de A como principal, fixar e testar também a exposição por pares como secundária |
| Simulação nula com adjacente sorteado uniformemente (`power2.mjs` linha 33) | AJUSTAR | alto | Não reproduz a circularidade; simular classificador que lê o estado latente (ver `core.mjs`, opção `circ`) |
| Confusão por volume | MUITO BOM (manter) | n/a | Desfecho como participação e exclusão do mês zero; funciona sob volume iid |
| Persistência da situação e repetição do mesmo participante | MELHORAR (acrescentar) | alto | Incluir agrupamento por participante; controle do histórico de B; análise com contribuidor como cluster |
| Reciprocidade na matriz (14 de 30 pares) | MELHORAR (acrescentar) | médio | Testar A para B condicionando em B para A e documentar a identificação |
| Pesquisa silenciosa como desfecho independente | MELHORAR (acrescentar) | médio | Boa ideia, sem simulação nem critério; pré especificar antes de usar |

### 4.2 Controle de erro tipo I (nota 4)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Permutação de meses com par e desfecho juntos (`power2.mjs` linhas 60 a 74) | MUITO BOM (manter) | n/a | Calibrada em cenários de meses trocáveis (4,3% a 5,6%) |
| Afirmar calibração sem cenários não iid (METODO linha 51) | AJUSTAR | crítico | Falha em tendência (11% a 20%), AR (7% a 9%), choque comum (8% a 10%), circular (7,5%) |
| Falso positivo médio "4,4%" | AJUSTAR | baixo | O script do repositório dá 4,77% |
| Exposição truncada nos primeiros meses | AJUSTAR | médio | Normalizar pelas defasagens disponíveis ou usar só meses com janela completa; reduz parte do excesso (3.2) |
| Família de 3 testes por prazo sem método declarado nem código | MELHORAR (acrescentar) | alto | Bonferroni 3 ou min P conjunto; mantém 5% só em meses trocáveis |
| "Dados não usados na descoberta" (critério 2, linha 90) | MELHORAR (acrescentar) | médio | As 30 hipóteses são dadas pela matriz, não descobertas; definir o que é descoberta (janela de exposição, estatística) e travar o código por hash antes dos dados |
| Placebo de tempo (linha 95) | DELETAR (remover ou descartar) | médio | Tautológico; substituir por placebo de antecedência |
| Teste em blocos citado na etapa 5 (linha 22) | DELETAR (remover ou descartar) | baixo | Não existe no código e o deslocamento circular testado tem 12% a 26% de erro |
| Escore de grupo com efeito de mês removido e teste t | MELHORAR (acrescentar) | alto | 4,3% a 7,0% nos cenários não iid, mesmo poder na DGP do documento |
| Etapa 3 usa FDR de Benjamini e Hochberg sobre 30 testes (linha 20) | AJUSTAR | médio | A decisão final usa nível 5% de família e teste global; FDR e FWER são coisas distintas; escolher uma |

### 4.3 Poder e dimensionamento (nota 3)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Tabela de poder reproduzível | MUITO BOM (manter) | n/a | 18 de 18 valores idênticos ao rodar o script; meu código concorda dentro do erro |
| Tabela sem IC e com 120 simulações | AJUSTAR | médio | Meia largura de até 8,9 pontos; reportar IC e usar 1000 ou mais simulações |
| "RR 1,5" como efeito mínimo detectável (linha 91) | AJUSTAR | alto | É pico, a média é cerca de 1,16 (3.3); com degrau, 20 grupos por 12 meses dá 60% |
| Decisão 1 aceita 10 grupos se 16 SED (linha 105) | AJUSTAR | alto | A tabela dá 75% e meu código 67%; abaixo da meta de 80% |
| Piloto de 20 grupos por 12 meses | AJUSTAR | alto | Suficiente apenas no cenário benigno; não considera supressão, erro de classe, correlação entre grupos |
| Dimensionar com a supressão do banco | MELHORAR (acrescentar) | crítico | 3.10 |
| Poder das classes por prazo e do critério de Brier | MELHORAR (acrescentar) | alto | 16% a 35% por classe; Brier 7% a 11% |
| Metas por faixa de volume real | MELHORAR (acrescentar) | médio | Só existe 1 faixa de volume realista a confirmar; os 8 SED por grupo e mês são hipótese e o texto diz |
| Poder da primeira simulação (83%) descartada | DELETAR (remover ou descartar) | baixo | `power_global.mjs` usa aproximação normal e defasagem 1; está superada e pode confundir o leitor |

### 4.4 Modelo de dados e premissas da simulação (nota 3)

| Premissa | Situação | Classe | Severidade |
|---|---|---|---|
| Contagens Poisson por grupo e mês, volume com variação de ±15% (linha 24) | Irrealista para grupos de 3 a 10 pessoas | AJUSTAR | médio |
| Dívidas equiprováveis | A realidade tem dívidas dominantes; afeta o escore (testei participações assimétricas: sem inflação, 5,5%) | AJUSTAR | baixo |
| Início gradual e consolidação tardia (rampa) | Boa resposta à correção do proprietário; mas a rampa não é identificável com as janelas sobrepostas | MUITO BOM (manter) com ajuste | médio |
| Independência entre grupos | Choque comum do cliente infla o erro (8% a 10%); mais forte com mais grupos (10,4% com 20) | MELHORAR (acrescentar) | alto |
| Sazonalidade | Ausente na simulação; com amplitude 0,6 o erro é 5,8%, a família 7,2% | MELHORAR (acrescentar) | médio |
| Autocorrelação | Ausente; AR 0,6 dá 8,6% | MELHORAR (acrescentar) | alto |
| Sobredispersão | Não simulada pelo documento; meu teste (volume e composição) não infla (4,8% e 5,2%) | MELHORAR (acrescentar) | baixo |
| Grupos com poucos participantes e participante repetido | Ausentes; a supressão depende deles | MELHORAR (acrescentar) | crítico |
| Exclusão do mês zero | Correta como medida de proteção, mas o gerador tem efeito no mês zero (`power2.mjs` linhas 20 e 29) que o teste joga fora | AJUSTAR | baixo |
| Efeito ligado só aos pares rotulados (`power2.mjs` linha 29 usa `xg`) | Premissa generosa: a conversão só acontece depois dos SED que o classificador rotulou | AJUSTAR | alto |
| 70% dos SED com adjacência | Hipótese; a sensibilidade não foi mostrada | MELHORAR (acrescentar) | baixo |

### 4.5 Critério de promoção (nota 4)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Níveis 0 a 4 com portões, "nenhum critério pode ser alterado depois de olhar os dados" (linhas 76 a 84) | MUITO BOM (manter) | n/a | Estrutura clara; separa interno de exibível |
| Rebaixamento (linha 101) | MUITO BOM (manter) | n/a | Falta apenas a regra para dados que não chegam |
| Nível 4 com ética, jurídico e teste de compreensão | MUITO BOM (manter) | n/a | Adequado |
| RR mínimo 1,5 com limite inferior do IC acima de 1 (linha 91) | AJUSTAR | alto | Ambíguo (a estimativa pontual deve passar de 1,5?). Se sim, o poder cai muito; e não existe estimador de RR (categoria 6) |
| Critério 5, Brier (linha 93) | AJUSTAR | crítico | Passa 7% a 11% das vezes com RR 1,5; reformular como ganho em log verossimilhança ou como exploratório |
| Critério 6, controle negativo com 60 pares (linha 94) | AJUSTAR | alto | Reprova método válido 7% a 99%; usar distribuição empírica da permutação e correção para testes dependentes |
| Critério 7, placebo de tempo (linha 95) | DELETAR (remover ou descartar) | médio | Tautológico |
| Critério 4, 2 de 3 clientes com mesmo sentido (linha 92) | AJUSTAR | médio | Sob a nula passa 50% das vezes; exigir heterogeneidade medida (I ao quadrado ou teste Q) e meta analítica |
| 3 clientes independentes, nenhum com mais de 50% (linha 89) | AJUSTAR | alto | Não diz quantos grupos por cliente; 20 grupos no total são cerca de 7 por cliente |
| Congelar o código e a estatística antes dos dados | MELHORAR (acrescentar) | alto | O texto congela critérios, não a estatística; as etapas 5 e 6 descrevem outro método (modelo binomial negativo) do que o simulado (escore). Isso é o "jardim das bifurcações" |
| Consolidação (critério 8) como desfecho secundário | MELHORAR (acrescentar) | baixo | Sem simulação |
| Revisão externa e ata (critério 9) | MUITO BOM (manter) | n/a | Mantém governança |

### 4.6 Medidas de efeito e intervalos (nota 3)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| "RR" como parâmetro do gerador | AJUSTAR | alto | O RR gerador (pico) não é o que o teste estima; o teste não produz RR |
| IC95 do RR (critérios 3 e 5) | MELHORAR (acrescentar) | crítico | Não há estimador nem método de IC no código; o IC por Wald sob binomial negativa ignora correlação intragrupo e a supressão |
| Modelo hierárquico binomial negativo (etapa 5, linha 22) | MELHORAR (acrescentar) | alto | Descrito, nunca implementado nem calibrado por simulação |
| Alternativas: escore por grupo com efeito de mês e teste t; bootstrap por grupo (para o IC); GEE com estrutura de trabalho de AR 1 e erros robustos (mais de 30 clusters, senão pouco confiável); modelo misto com efeito aleatório por grupo e efeito fixo de mês | MELHORAR (acrescentar) | alto | Testado apenas o escore de grupo (3.5); os demais não foram executados por mim |
| Medida em escala de contagem versus participação | AJUSTAR | baixo | O texto fala em participação; o código usa resíduo de contagem ponderado pelo volume (`power2.mjs` linha 54) |

### 4.7 Qualidade de dados (nota 3)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Grupos com ao menos 3 participantes | AJUSTAR | crítico | Regra de privacidade tratada como qualidade; o limite é por célula e suprime quase tudo (3.10) |
| Maturidade N2 ou superior | AJUSTAR | médio | Sem definição operacional neste documento |
| Kappa de 0,61 por repetição | AJUSTAR | alto | Mede estabilidade, não acerto; um classificador estável e enviesado passa. Exigir verdade de referência rotulada por humanos; kappa 0,61 equivale a poder de 60% a 65% (3.9) |
| Sem deriva de base (todos os scores subindo juntos) | MELHORAR (acrescentar) | alto | Deriva é a tendência comum que infla o erro (11% a 20%); falta teste e limite numérico |
| Medir o volume por célula antes do piloto | MELHORAR (acrescentar) | alto | Sem isso, o dimensionamento é opinião |

### 4.8 Reprodutibilidade e implementação (nota 6)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Semente fixa e execução determinística (`power2.mjs` linhas 17, 76, 78) | MUITO BOM (manter) | n/a | A tabela reproduz exatamente |
| Fluxo único de aleatoriedade das permutações (`rng(99)` linha 76) | AJUSTAR | baixo | Compartilhado por todos os cenários; correlaciona o erro Monte Carlo entre células |
| "4,4%" no texto versus 4,77% no script | AJUSTAR | baixo | 3.1 |
| Modo `fp` roda 5 de 27 cenários, todos iid (linha 87) | AJUSTAR | médio | Ampliar para cenários adversos |
| Etapas 2 e 3 pedem simular o detector `emergingPairs` (linhas 19 e 20); nenhum script simula o detector | MELHORAR (acrescentar) | alto | `adjacency.ts` (linhas 80 a 82 e 119) fica desconectado do teste usado nas decisões |
| `adjacentAsPrincipalAfter` (`adjacency.ts` linhas 83 a 94) conta meses após o primeiro registro com B principal | AJUSTAR | médio | Sem linha de base: dívida frequente "converte" sempre. Já está rotulado como "evidência bruta"; manter fora de qualquer decisão |
| Detector exige `latest` global e sequência sem lacunas (linhas 69 e 82) | AJUSTAR | médio | Com células suprimidas haverá lacunas por privacidade, que quebram a sequência |
| Ausência de testes unitários do módulo de simulação | MELHORAR (acrescentar) | médio | Nenhum teste para `power2.mjs` |
| `power.mjs` e `power_global.mjs` | DELETAR (remover ou descartar) | baixo | Superados; manter apenas com aviso |
| Loop de sorteio sem limite (`power2.mjs` linha 33: `while(u>w[d])`) | AJUSTAR | baixo | Em caso de erro de arredondamento `d` pode passar de 9 |

### 4.9 Risco ético e de decisão (nota 6)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Uso interno, `visibility: "internal"` e proibição de exibir antes da confirmação (`adjacency.ts` linhas 4 a 16) | MUITO BOM (manter) | n/a | Boa barreira |
| Nível 4 separado, com revisão ética e jurídica | MUITO BOM (manter) | n/a | |
| Custo do falso positivo (exibir conversão inexistente a RH) | MELHORAR (acrescentar) | alto | Pode levar a ação sobre pessoas ou líderes por associação espúria; documentar como risco e fixar nível de erro por consequência, não 5% genérico |
| Custo do falso negativo | MELHORAR (acrescentar) | médio | Com poder de 5% sob a supressão, o sistema nunca "confirma"; não deveria virar argumento de que a conversão não existe |
| Uso interno que molda o tom dos agentes (METODO linha 3 e fundamentos) | MELHORAR (acrescentar) | médio | Se a adjacência influenciar respostas ao usuário antes da confirmação, ela já está "exibida" na prática |
| Privacidade de grupos pequenos e pares raros | AJUSTAR | médio | k = 3 não é anonimização (o próprio `schema.sql` diz); pares raros identificam situações; aplicar supressão complementar |
| Linguagem ("conversão", "vira") | AJUSTAR | médio | Usar "antecede" até o nível 4 |

### 4.10 Clareza e completude do documento (nota 6)

| Ponto | Classe | Severidade | Evidência e ação |
|---|---|---|---|
| Premissas declaradas como hipóteses e não dados | MUITO BOM (manter) | n/a | Linha 56 |
| Decisões datadas e a aprovar | MUITO BOM (manter) | n/a | |
| Etapas 2, 3, 5 e 6 descrevem um método (detector com FDR, modelo hierárquico) diferente do simulado (escore global) | AJUSTAR | alto | Reescrever o documento em torno do método realmente simulado |
| Falta definir a unidade do RR, o estimador e o IC | MELHORAR (acrescentar) | alto | |
| Falta declarar a janela de exposição de cada classe | AJUSTAR | médio | O texto diz "início da janela até 6 meses", o que sobrepõe as classes |
| Falta tabela de poder com IC e com cenários adversos | MELHORAR (acrescentar) | médio | |
| "A segunda rodada pede revisão" (linha 41) | AJUSTAR | baixo | Substituir pela decisão tomada |

## 5. Quais problemas são mais graves (ordem)

1. Supressão de células por 3 participantes distintos torna o piloto sem poder (3.10). Crítico.
2. Calibração testada só em cenários iid; tendência, autocorrelação, choque comum e classificador circular elevam o erro (3.2). Crítico.
3. Não existe estimador de RR nem IC; os critérios 3 e 5 dependem deles (4.6). Crítico.
4. Brier fora da amostra praticamente inatingível; controle negativo reprova método válido; placebo de tempo vazio (3.11). Alto.
5. Circularidade: o desfecho 3 (IEC) é circular por fórmula, o desfecho 1 compartilha o classificador, a simulação nula não reproduz isso (3.6). Alto.

## 6. Pontos mais fortes

1. A tabela de poder é reproduzível e correta dentro do mundo simulado.
2. A permutação de meses mantendo par e desfecho do mesmo mês é calibrada em meses trocáveis e foi uma correção honesta de um erro de 28%.
3. Exclusão do mês zero e uso de participação no mês como desfecho removem a correlação mecânica por volume.
4. Estrutura em níveis, critérios fixados antes dos dados, rebaixamento e revisão externa, com nível 4 separado e revisão ética.
5. Linguagem de associação (não causa) e uso interno com visibilidade restrita.

## 7. Ajustes mínimos que eu exigiria

1. Medir, antes de qualquer piloto, a distribuição real de SED por grupo, mês, dívida e participante distinto; refazer o dimensionamento com a supressão aplicada ou autorizar formalmente um canal de análise com eventos brutos (decisão de privacidade).
2. Substituir o IC por Wald e o "RR" por um estimador definido (por exemplo razão de taxas em modelo de contagem com efeito fixo de mês e erro robusto por grupo), com calibração demonstrada por simulação.
3. Calibrar sob cenários adversos (tendência, AR, sazonalidade, choque comum, classificador circular) e adotar o teste que se mantém em 5% neles. Candidato: escore por grupo com efeito de mês removido, teste t ou bootstrap por grupo.
4. Trocar a exposição por pares rotulados pela contagem de A como principal, ou testar as duas e decidir antes dos dados qual é a primária.
5. Retirar o desfecho 3 (IEC de B), o placebo de tempo e o critério de Brier como está; reformular o controle negativo.
6. Declarar e simular o teste por classe de prazo com janelas não sobrepostas, ou assumir que o prazo não é validado.
7. Congelar por hash o código, a estatística e a janela antes de ver dados reais.

## 8. Reprodução

Em `auditoria_externa/` (cada comando roda em Node sem dependências):

* `node fp.mjs all 2000 199` calibração em cenários nulos (16 cenários, cerca de 25 minutos em 1 núcleo).
* `node power.mjs tabela 600`, `node power.mjs classes 600`, `node power.mjs dimensionamento 300`, `node power.mjs dimstep 300`, `node power.mjs supressao 300`.
* `node diag.mjs neg 200`, `placebo 300`, `misclass 300`, `brier 120`.
* `node variantes.mjs 500`, `node variantes_driverA.mjs 500`, `node janela.mjs 1000`.
* `copia_power_global_uma_celula.mjs` é cópia do `power_global.mjs` do repositório com a grade reduzida, só para checar o número de 83%.
* Resultados que usei estão em `resultados/`.

## 9. Limitações da auditoria (o que não verifiquei)

* A matriz M foi copiada de `power2.mjs`. Conferi com o texto do Mestre (tabela T03 e seções por dívida) apenas as adjacentes imediatas e curtas das dívidas D1 a D4 e D9; as demais linhas e os prazos "médio" não foram conferidos contra o Documento 1.
* Os cenários adversos são hipóteses minhas (valores de tendência, AR, choque, circularidade). Não há dados reais; não sei o quanto cada um ocorre.
* O classificador real, o volume real por grupo e o número de participantes distintos por célula não existem no repositório.
* O modelo binomial negativo hierárquico, GEE e modelo misto citados como alternativas não foram executados; testei o escore por grupo com teste t e a permutação.
* Perda de poder atribuível à permutação em si, em comparação com um teste paramétrico correto, só foi medida em um cenário.
* Os números de supressão tratam células suprimidas como zero e assumem um participante por SED (melhor caso). A mesma execução com `momento` incluído não foi feita.
* A grade de dimensionamento para 16 SED não terminou; o que citei da grade é o que terminou.
* Mapeamento entre kappa e erro de classificação é aproximação (prevalências iguais).
* A semente fixa implica que alguns ICs não são independentes entre si.

## 10. VEREDITO

**VIÁVEL SÓ PARA FASE EXPLORATÓRIA, NÃO PARA CONFIRMAÇÃO**

Justificativa: (a) controle de falso positivo: correto sob meses trocáveis, incorreto em cenários plausíveis de dado real; (b) poder: a conta é correta, mas o piloto de 20 grupos por 12 meses só atinge 90% sob as premissas mais favoráveis, e com a supressão do banco o poder é nulo; (c) interpretabilidade: o desfecho 3 é circular por fórmula, o desfecho 1 compartilha o classificador, e o teste mede "A antecede B em até 6 meses", não o prazo nem o rótulo; (d) decisão: o critério de promoção tem itens inatingíveis (Brier), vazios (placebo de tempo) e mal calibrados (controle negativo), e depende de um RR e de um IC que o código não produz. Como instrumento exploratório interno (nível 0 e 1 do próprio documento), com a linguagem de associação, é utilizável. Como base para um nível 3 confirmado ou para exibição ao cliente, não.

**Condições sem as quais eu não recomendaria exibir adjacência a um cliente:**

1. Dado: volume real medido; análise com poder demonstrado sob as regras de supressão em vigor, ou canal autorizado de eventos brutos.
2. Calibração de erro tipo I demonstrada em cenários não iid (tendência, autocorrelação, choque comum, classificador circular), com IC.
3. Estimador do efeito e IC definidos e validados por simulação, com cluster por grupo e por participante.
4. Exposição e desfecho independentes do classificador (ou confusão medida e descontada); retirada do IEC como desfecho.
5. Replicação em pelo menos 3 clientes reais, em período posterior, com análise congelada por hash antes do dado.
6. Critérios de promoção reescritos de modo que cada um seja alcançável com o tamanho de piloto (ou com tamanho redimensionado), com a probabilidade conjunta calculada.
7. Validação do classificador contra verdade humana, com a perda de poder por erro de classe considerada.
8. Revisão ética e jurídica do texto exibido, com linguagem de associação, e plano de comunicação do erro.

**Grau de confiança no veredito:** moderado a alto (cerca de 75%) para as conclusões de que a calibração depende da exigência de meses trocáveis, de que o poder some sob a supressão e de que os critérios 5 a 7 não funcionam como escritos; moderado a baixo (cerca de 50%) para a magnitude dos efeitos nos cenários adversos, porque dependem de parâmetros que inventei.
