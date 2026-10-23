# Correções necessárias nos documentos oficiais (Drive)

Lista de inconsistências encontradas entre documentos e o que mudar em cada um. Nenhum arquivo do Drive foi alterado. A decisão sobre cada texto é do proprietário; a coluna "Proposta" é a leitura do engenheiro.

## Prioridade alta (contradizem decisões já tomadas)

| # | Onde | Trecho atual | Proposta |
|---|---|---|---|
| 1 | Roteiro, slide 10 | O Agente de Contenção responde ao caso "meu par fechou com o cliente sem me envolver" | O Canônico (cenário 10, D01 a D03) manda esclarecer a necessidade antes de rotear: Impacto se o centro for o efeito relacional, Mentor se for uma escolha, Crises se houver pressão e risco relevante. Trocar a fala por uma pergunta de esclarecimento ou usar outro caso |
| 2 | Health Monitor (Doc 6), seções 11.3 e 11.4 | "Health Monitor gratuito" nos meses 1 a 6 e "você recebe Health Monitor, Auditoria e Cultural Risk Engine gratuitamente" | Regra do proprietário: o Cultural Risk Engine fica 6 meses habilitado **quando o cliente fecha contrato de 12 meses**; não há 6 meses gratuitos. Reescrever as duas seções |
| 3 | Health Monitor (Doc 6), seção 11.3 | Contrato de 6 meses: Cultural Risk Engine "não habilitado" e "Auditoria entregue ao final do 6º mês" | A Auditoria depende do IEC, que o Risk Engine calcula. Definir se o contrato de 6 meses recebe Auditoria e, se sim, como o IEC é calculado |
| 4 | Documentos que dizem "fundidos" ou "consolidados com grupos adjacentes" | Dossiê Metodológico (7.1), Manual de Auditoria (3.4 e 4.1), Doc 3 (3.2 e 7.1), Doc 6 (3.5 e 4.1), Roteiro (slide 12) | Decisão C: grupos com menos de 3 participantes são suprimidos, sem fusão automática. O MESTRE já foi ajustado |
| 5 | Dossiê de arquitetura enviado antes (não está na pasta do Drive) | Cita "2 ciclos trimestrais" | Ciclo de apuração é o mês UTC (decisão D). Persistência = 2 ciclos mensais consecutivos |

## Prioridade média (contradições entre documentos oficiais)

| # | Onde | Contradição | Proposta |
|---|---|---|---|
| 6 | Doc 3 (2.1) | Expande SED como "Sinais Estruturais de Decisão" | Structured Event Data, como em todos os outros documentos |
| 7 | Doc 3 (2.2) e Metodologia Completa | Valores de `actor`: `pares` e `líder` | Mestre: `time, par, liderado, chefe, cliente` |
| 8 | Doc 2 (2.3) x Doc 6 (4.4) | I_d contínuo de 0 a 1 (4 dimensões) x saída categórica 1, 2 ou 3 | Escolher um. Definir também como a intensidade proxy do SED vira I_d |
| 9 | Doc 2 (2.2) x motor | T = ciclos observados no período; o ensaio de 11/10/2026 usa T = 20 | Definir a unidade de T e recalibrar o ensaio se T mudar |
| 10 | Manual de Auditoria (4.2) x Mestre, Doc 2, Doc 3, Doc 6 | Entrega executiva com IEC simplificado (sem S e A) x IEC completo | Definir um número para o cliente |
| 11 | Manual de Auditoria (2.2) | Cita N0 a N4 por tempo, mas não define "IEC estável" | Definir o critério numérico do N4 |
| 12 | Doc 1 (9.8) x Metodologia Completa e Dossiê | "Não estabelece data de vigência" x "NR-1 em vigor desde maio de 2026" | Validação jurídica antes de qualquer valor ou data em produto. O valor de R$ 3,75 bi (Fontes, Roteiro slide 5) não deve ir a tela sem validação |
| 13 | Doc 6 (3.3) x Manual de Auditoria (bloco 6) | 20 a 25 perguntas aplicadas x banco de 30 | Banco de 30, aplicação de 20 a 25. Registrar nos dois |
| 14 | Doc 6 (3.4) | Pesos I+, I e R (1,5, 1,0 e 0,3) sem a tabela por pergunta | Atribuir o peso de cada uma das 30 perguntas |
| 15 | Matriz Executiva (HTML) | Numeração das dívidas diferente do Manual e do Dossiê | Referir por nome ou código; ordem varia |
| 16 | Calculadora DCO (HTML) | Multiplicadores 1,0, 1,25 e 1,5 por 3 zonas; ROI de 15% e projeção de 15 a 35% ao ano sem fonte | Alinhar aos multiplicadores oficiais (0,7, 1,0, 1,4, 1,8) e remover ou justificar ROI e projeção |
| 17 | Biblioteca de momentos | Duas versões: "MOMENTOS DE ATIVAÇÃO CORRIGIDO" e arquivos por agente | Os arquivos por agente (80 momentos no Agente 5) são a fonte; marcar o CORRIGIDO como superado |
| 18 | Roteiro (slide 25) x Doc 6 (11) | Piloto de 30 dias grátis com mínimo de 3 líderes x contrato de 6 ou 12 meses | Explicitar que são ofertas distintas |

## Prioridade baixa

| # | Onde | Detalhe |
|---|---|---|
| 19 | Manual de Auditoria, questionário (Confiança Erosionada, item 3) | "saía errado": ortografia. No banco de perguntas do código está "saia errado" |
| 20 | Doc 3 (3.5) | A curva logística de recorrência aparece como se fosse a fórmula de uso, mas a nota de versão diz que é v2.0. Deixar a nota em destaque |

## Pendências de parâmetros que só o proprietário define

Matriz de interdependência M (10x10), limiar de ocorrência relevante para o amortecimento, limiar θ do alerta azul, critério de deriva (Doc 6, 4.5) e peso de cada pergunta.
