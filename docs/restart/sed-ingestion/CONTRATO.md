# Contrato de ingestão: SED de evento e resposta da pesquisa silenciosa

Estado: proposta para aprovação do dono. Implementação de referência em `lib/review`. Nada aqui está implantado em nuvem, e nenhum SED real é gravado enquanto as conversas dos agentes não estiverem boas.

Fonte de verdade da definição do SED: `docs/restart/MESTRE.md`, seção 7. Os documentos de arquitetura de integração (webhook SED v2, DDL e referência Python) foram a base do desenho de segurança. Este contrato reconcilia os conflitos entre eles.

## Decisões deste contrato

| # | Conflito | Decisão |
|---|---|---|
| A | O webhook v2 e o MESTRE descrevem SED diferentes | O **SED de evento** segue o MESTRE. O v2 deixa de ser usado como formato de evento |
| B | Quem produz os 4 escores de 0 a 4 | Os escores 0 a 4 são **respostas da pesquisa silenciosa**, num tipo de mensagem e numa tabela próprios. A intensidade do evento é Baixa, Média ou Alta, inferida, nunca perguntada |
| C | Grupo pequeno: fundir ou suprimir | **Suprimir.** Nenhum agregado é publicado com menos de 3 participantes distintos na mesma amostra. Não há fusão automática de grupos. O MESTRE e o Dossiê devem ser atualizados |
| D | Significado de "ciclo" | **Ciclo de apuração = mês UTC.** Persistência para alerta = 2 ciclos de apuração consecutivos com o padrão mantido. Primeiro alerta só depois de 3 ciclos com dados. O texto "2 ciclos trimestrais" do Dossiê deve ser corrigido. A unidade de T (baseline) é eventos por ciclo de apuração e continua a definir |

Pendências que **não** foram decididas e portanto não estão no código:

- **Tipo de decisão** (campo do MESTRE): é fragmento de decisão trabalhado. Em texto livre vazaria conteúdo da conversa. Só entra quando houver lista fechada de valores.
- **Transformação da intensidade proxy (Baixa, Média, Alta) em I_d** (0 a 1, quatro dimensões): o motor recebe I_d pronto. A regra de conversão precisa ser definida pelo dono, com justificativa metodológica.
- **Insumos do DCO** (R, T, P, C): vêm do cliente ou de estimativa contratada, não do SED.
- **Passivo jurídico (NR-1)** no demonstrativo: valor fixo de ilustração. Exige validação jurídica antes de aparecer em produto.

## Mensagem 1: SED de evento (`kind = "sed"`)

Todos os campos são obrigatórios e campos extras são rejeitados.

| Campo | Tipo | Regra |
|---|---|---|
| `schema_version` | inteiro | 3 |
| `kind` | texto | `"sed"` |
| `event_id` | texto | 1 a 100 caracteres, único por cliente |
| `timestamp` | texto | ISO 8601 com fuso, ocorrência do evento, não pode estar mais de 300 s no futuro |
| `client_id` | texto | igual ao cliente da credencial |
| `group_id` | inteiro | grupo cadastrado do cliente |
| `contributor_token` | texto | 64 hexadecimais minúsculos; pseudônimo estável por cliente e ciclo, gerado pelo IAí |
| `debt_principal` | inteiro | 1 a 10 |
| `debt_adjacent` | inteiro ou nulo | 1 a 10, diferente de `debt_principal`; hipótese da matriz, oculta da empresa |
| `context` | texto | `conflito`, `decisao`, `alinhamento`, `feedback`, `crise` |
| `actor` | texto | `time`, `par`, `liderado`, `chefe`, `cliente` |
| `momento` | texto | `Antes`, `Durante`, `Depois`, `Padrao`, `Vazio` |
| `intensity_proxy` | texto | `Baixa`, `Media`, `Alta` |

## Mensagem 2: resposta da pesquisa silenciosa (`kind = "survey"`)

| Campo | Tipo | Regra |
|---|---|---|
| `schema_version` | inteiro | 3 |
| `kind` | texto | `"survey"` |
| `event_id`, `timestamp`, `client_id`, `group_id`, `contributor_token` | | como acima |
| `question_id` | texto | `A1` a `H3`, conforme o banco oficial do questionário (letra A a H, número de 1 a 6) |
| `answer` | inteiro | 0 (Nunca) a 4 (Quase sempre) |

## Autenticação do envio

Cabeçalhos `x-prioris-key-id`, `x-prioris-timestamp` (segundos Unix da tentativa, tolerância de 300 s) e `x-prioris-signature` (64 hexadecimais). A assinatura é HMAC SHA 256 de `timestamp + "." + corpo original em bytes`, conferida em tempo constante **antes** de interpretar o JSON. A chave tem no mínimo 32 bytes e pertence a um único cliente, resolvida num cadastro do servidor. Requisição não autenticada ou malformada nunca entra na fila.

## Privacidade e publicação

- O token do participante é pseudônimo, não anonimização. Não vai a painel nem a log.
- A ingestão grava com papel que só tem SELECT e INSERT. O consumo é feito por funções de publicação que devolvem agregados de **ciclo encerrado** com no mínimo 3 participantes distintos.
- As funções de publicação alimentam o **motor**, no servidor. O painel não consome contagens exatas nem eventos individuais.
- Ciclo encerrado não reabre.
- Retenção, exclusão controlada e auditoria precisam ser definidas antes de dados reais.

## Maturidade e o que o motor não faz

O motor recebe agregados já liberados. Ele **não** calcula IEC com densidade abaixo do nível N2 (Dossiê, Parte 10) nem a partir de um evento. Abaixo de N2 a resposta é "indisponível por maturidade".
