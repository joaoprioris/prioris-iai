# Correções necessárias nos documentos oficiais (Drive)

**Atualização de 23/10/2026.** Os itens 4, 22 e 23 (e o slide 12 do Roteiro) já têm o par "trecho atual / trecho novo" em `ERRATA_DRIVE.md` e no Google Doc `ERRATA_DOCUMENTOS_D10_E_DECISAO_C` (raiz do Drive). As correções foram aplicadas no Drive em 23/10/2026 por reconstrução em Google Doc (originais em `HISTORICO_ORIGINAIS_DOCX`). Política comercial (itens 2, 3 e 18) está fora de escopo até o proprietário estruturá-la.

Lista de inconsistências encontradas entre documentos e o que mudar em cada um. Nenhum arquivo do Drive foi alterado. A decisão sobre cada texto é do proprietário; a coluna "Proposta" é a leitura do engenheiro.

## Prioridade alta (contradizem decisões já tomadas)

| # | Onde | Trecho atual | Proposta |
|---|---|---|---|
| 1 | Roteiro, slide 10 | O Agente de Contenção responde ao caso "meu par fechou com o cliente sem me envolver" | O Canônico (cenário 10, D01 a D03) manda esclarecer a necessidade antes de rotear: Impacto se o centro for o efeito relacional, Mentor se for uma escolha, Crises se houver pressão e risco relevante. Trocar a fala por uma pergunta de esclarecimento ou usar outro caso |
| 2 | Health Monitor (Doc 6), seções 11.3 e 11.4 | "Health Monitor gratuito" nos meses 1 a 6 e "você recebe Health Monitor, Auditoria e Cultural Risk Engine gratuitamente" | **Política comercial: fora de escopo por decisão do proprietário** (ele vai estruturá-la). Nenhuma edição por ora. Nota técnica: o Risk Engine roda sempre, o contrato só decide o que o cliente vê |
| 3 | Health Monitor (Doc 6), seção 11.3 | Contrato de 6 meses: Cultural Risk Engine "não habilitado" e "Auditoria entregue ao final do 6º mês" | Resolvido tecnicamente: o Risk Engine está ativo para todo cliente, sem que o cliente saiba; a Auditoria pode usar o IEC. A redação comercial do 11.3 fica com o proprietário |
| 4 | Documentos que dizem "fundidos" ou "consolidados com grupos adjacentes" | Dossiê Metodológico (7.1), Manual de Auditoria (3.4 e 4.1), Doc 3 (3.2 e 7.1), Doc 6 (3.5 e 4.1), Roteiro (slide 12) | Decisão C: grupos com menos de 3 participantes são suprimidos, sem fusão automática. O MESTRE já foi ajustado |
| 5 | Dossiê de arquitetura enviado antes (não está na pasta do Drive) | Cita "2 ciclos trimestrais" | Ciclo de apuração é o mês UTC (decisão D). Persistência = 2 ciclos mensais consecutivos |

## Prioridade média (contradições entre documentos oficiais)

| # | Onde | Contradição | Proposta |
|---|---|---|---|
| 6 | Doc 3 (2.1) | Expande SED como "Sinais Estruturais de Decisão" | Structured Event Data, como em todos os outros documentos |
| 7 | Doc 3 (2.2) e Metodologia Completa | Valores de `actor`: `pares` e `líder` | Mestre: `time, par, liderado, chefe, cliente` |
| 8 | Doc 2 (2.3) x Doc 6 (4.4) | I_d contínuo de 0 a 1 (4 dimensões) x saída categórica 1, 2 ou 3 | Resolvido por D07: são usos distintos, sem conversão direta. Registrar essa distinção nos dois documentos e especificar como as evidências alimentam cada etapa |
| 9 | Doc 2 (2.2) x motor | T = ciclos observados no período; o ensaio de 11/10/2026 usa T = 20 | Definir a unidade de T e recalibrar o ensaio se T mudar |
| 10 | Manual de Auditoria (4.2) x Mestre, Doc 2, Doc 3, Doc 6 | Entrega executiva com IEC simplificado (sem S e A) x IEC completo | Definir um número para o cliente |
| 11 | Manual de Auditoria (2.2) | Cita N0 a N4 por tempo, mas não define "IEC estável" | Definir o critério numérico do N4 |
| 12 | Doc 1 (9.8) x Metodologia Completa e Dossiê | "Não estabelece data de vigência" x "NR-1 em vigor desde maio de 2026" | Validação jurídica antes de qualquer valor ou data em produto. O valor de R$ 3,75 bi (Fontes, Roteiro slide 5) não deve ir a tela sem validação |
| 13 | Doc 6 (3.3) x Manual de Auditoria (bloco 6) | 20 a 25 perguntas aplicadas x banco de 30 | Banco de 30, aplicação de 20 a 25. Registrar nos dois |
| 14 | Doc 6 (3.4) | Pesos I+, I e R (1,5, 1,0 e 0,3) sem a tabela por pergunta | Atribuir o peso de cada uma das 30 perguntas |
| 15 | Matriz Executiva (HTML) | Numeração das dívidas diferente do Manual e do Dossiê | Referir por nome ou código; ordem varia |
| 16 | Calculadora DCO (HTML) | Multiplicadores 1,0, 1,25 e 1,5 por 3 zonas; ROI de 15% e projeção de 15 a 35% ao ano sem fonte | Alinhar aos multiplicadores oficiais (0,7, 1,0, 1,4, 1,8) e remover ou justificar ROI e projeção |
| 17 | Biblioteca de momentos | Duas versões: "MOMENTOS DE ATIVAÇÃO CORRIGIDO" e arquivos por agente | Os arquivos por agente (390 unidades principais: 80 de Perfil, Impacto, Feedback e 1:1, e 70 de Crises) são o denominador. O CORRIGIDO (168 registros) e o Guia de Conversão (10) são 178 registros complementares preliminares, fora desse denominador. Deixar isso explícito nos arquivos |
| 18 | Roteiro (slide 25) x Doc 6 (11) | Piloto de 30 dias grátis com mínimo de 3 líderes x contrato de 6 ou 12 meses | Explicitar que são ofertas distintas |
| 22 | Mestre (bloco 8), Doc 2 (4.2), Manual de Auditoria (4.4), Doc 6 (4.5), Dossiê e Arquitetura (seção 10) | "Máximo de 3 dívidas em vermelho por ciclo" apresentado como regra do sistema | Decisão D10: o Top 3 é só recorte comercial; o motor, o banco e a matriz mostram as dez dívidas, e dado insuficiente não é zero nem verde. Corrigir a redação. `docs/restart/MESTRE.md` já foi corrigido no repositório (os textos de `methodology/` são cópias fiéis das fontes e ficam como estão). O registro de divergências já lista as passagens F10:P0298, F21:P0237, F23:P0196 |
| 23 | Backlog Técnico, tickets 6.1 e 6.2 (Feedback Estruturado) | "Não interpreta contexto" e "não sugere se deve ou não dar feedback" | São de março/2026. O Mestre e o caso de referência do proprietário pedem distinguir impressão de fato e explorar o objetivo e a abordagem do líder. Revisar os dois tickets |
| 24 | Dois documentos chamados "Documento Mestre" | O da raiz (v1.0, 21/10, briefing de entrada) e o da pasta IMPLEMENTAÇÃO (edição 2.0, 93 páginas, 15/10) | Renomear um deles ou registrar a relação entre os dois. O de 93 páginas não foi lido nesta revisão |
| 25 | Playbook Operacional de 60 dias | Classificador de 4 categorias e 4 prompts do MVP v0.1 | O próprio cabeçalho já diz que está superado pelos 8 agentes. Marcar o arquivo como histórico |

## Prioridade baixa

| # | Onde | Detalhe |
|---|---|---|
| 19 | Manual de Auditoria, questionário (Confiança Erosionada, item 3) | "saía errado": ortografia. No banco de perguntas do código está "saia errado" |
| 20 | Doc 3 (3.5) | A curva logística de recorrência aparece como se fosse a fórmula de uso, mas a nota de versão diz que é v2.0. Deixar a nota em destaque |

## Pendências de parâmetros que só o proprietário define

Matriz de interdependência M (10x10), limiar de ocorrência relevante para o amortecimento, limiar θ do alerta azul, critério de deriva (Doc 6, 4.5) e peso de cada pergunta.
