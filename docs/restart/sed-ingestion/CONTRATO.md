# Contrato de ingestão: SED de evento e resposta da pesquisa silenciosa

Estado: proposta para aprovação do dono. Implementação de referência em `lib/review`. Nada aqui está implantado em nuvem, e nenhum SED real é gravado enquanto as conversas dos agentes não estiverem boas.

Fonte de verdade da definição do SED: `docs/restart/MESTRE.md`, seção 7. Os documentos de arquitetura de integração (webhook SED v2, DDL e referência Python) foram a base do desenho de segurança. Os documentos oficiais da metodologia (Modelo IEC, Cultural Risk Engine, Health Monitor, Manual de Auditoria) definiram parâmetros e regras. Este contrato reconcilia os conflitos entre eles.

## Decisões deste contrato

| # | Conflito | Decisão |
|---|---|---|
| A | O webhook v2 e o MESTRE descrevem SED diferentes | O **SED de evento** segue o MESTRE. O v2 deixa de ser usado como formato de evento |
| B | Quem produz os escores de 0 a 4 | Os escores 0 a 4 são **respostas da pesquisa silenciosa**, num tipo de mensagem e numa tabela próprios. A intensidade do evento é Baixa, Média ou Alta, inferida, nunca perguntada |
| C | Grupo pequeno: fundir ou suprimir | **Suprimir.** Nenhum agregado é publicado com menos de 3 participantes distintos na mesma amostra. Não há fusão automática de grupos. Os documentos oficiais ainda dizem "fundidos" (ver `CORRECOES_DOCUMENTOS.md`) |
| D | Significado de "ciclo" | **Ciclo de apuração = mês UTC.** Persistência para alerta = 2 ciclos de apuração consecutivos com o padrão mantido. Primeiro alerta só depois de 3 ciclos com dados |
| E | Identificação da dívida | **Código textual**, nunca a posição. A numeração varia entre documentos (a Matriz Executiva numera Alinhamento Simbólico como 6, o Manual como 8) e o MESTRE manda referir pelo nome. Nomes curtos das bibliotecas ("Energia Emocional", "Maturidade Política") são apelidos listados explicitamente; não há equivalência por semelhança |
| F | Banco de perguntas | **30 itens, 3 por dívida** (Manual de Auditoria, bloco 6), com id `<código da dívida>.<1 a 3>`. A entrega ao líder é de 20 a 25 itens em no mínimo 6 meses, nunca em sequência por dívida (Health Monitor, 3.3). A tabela `questions` guarda o peso (R, I ou I+), nulo até o proprietário definir |
| G | Maturidade N0 a N4 | **Tempo como no MESTRE e no Manual:** N2 com 3 meses ou mais, N3 com 6 meses ou mais, N4 exige IEC estável. N2 ou mais exige taxa de resposta de 35% ou mais e 2 ciclos consecutivos. O nível é o menor entre volume, líderes ativos e tempo |
| H | IEC completo ou simplificado | O motor calcula e guarda os dois. A fórmula completa (com S e A) está no MESTRE, Doc 2, Doc 3 e Doc 6; o Manual (4.2) cita a simplificada para a entrega executiva. **Qual aparece ao cliente é decisão do proprietário**; recomendação: completo |
| I | Habilitação por contrato | Tabela `client_entitlements` (contrato de 6 ou 12 meses, `cre_enabled`, `alerts_enabled`; alerta exige o Risk Engine). Regra comercial do proprietário: o Cultural Risk Engine fica **6 meses habilitado quando o cliente fecha contrato de 12 meses**. A coleta funciona sempre. O que vale depois dos 6 meses é dado administrativo, não regra de código |
| J | Glossário | O SED é **Structured Event Data** (o Doc 3 diz "Sinais Estruturais de Decisão", a corrigir). Valores de `actor` seguem o MESTRE: `time, par, liderado, chefe, cliente` (o Doc 3 e a Metodologia Completa dizem `pares` e `líder`) |
| K | Individual x organizacional | O Health Monitor Individual (custos pessoais do líder) tem dados separados, acesso só do líder e nunca entra no pipeline organizacional. **Não está neste contrato.** Quando for implementado, exige tabelas, papéis e funções próprios; nenhuma tabela deste esquema pode ser reaproveitada |

Pendências que **não** foram decididas e portanto não estão no código:

- **Tipo de decisão** (campo do MESTRE): é fragmento de decisão trabalhado. Em texto livre vazaria conteúdo da conversa. Só entra quando houver lista fechada de valores.
- **Transformação da intensidade proxy (Baixa, Média, Alta) em I_d:** o Doc 2 define I_d contínuo de 0 a 1 (Op 0,30, Rel 0,25, Dec 0,25, Pol 0,20) e o Doc 6 (4.4) define saída categórica 1, 2 ou 3. Os dois se contradizem, e nenhum diz como chegar às dimensões. O motor recebe I_d pronto.
- **T da recorrência:** o Doc 2 define T como o número de ciclos observados no período. O motor usa T = 20 (baseline que reproduz o ensaio de 11/10/2026). A troca muda os resultados do ensaio.
- **Matriz de interdependência M (10x10):** proprietária e ausente dos documentos. O motor recebe a soma ponderada dos IEC adjacentes já calculada.
- **Limiar de "ocorrência relevante" para o amortecimento A:** o motor usa `f > 2`, regra do ensaio sem fonte nos documentos oficiais.
- **Alerta azul:** depende do limiar de consolidação (θ), ainda não definido.
- **Pesos das perguntas (R, I, I+):** o Doc 6 define os fatores 1,5, 1,0 e 0,3, mas nenhum documento diz qual pergunta tem qual peso.
- **Detecção de deriva** (Doc 6, 4.5): sem critério numérico.
- **Critério de IEC estável** (para o N4): sem definição numérica.
- **Insumos do DCO** (R, T, P, C): vêm do cliente ou de estimativa contratada, não do SED.
- **Passivo jurídico (NR-1)** no demonstrativo: o Doc 1 (9.8) diz que não estabelece data de vigência e a Metodologia Completa diz "em vigor desde maio de 2026". Exige validação jurídica antes de aparecer em produto.

## Mensagem 1: SED de evento (`kind = "sed"`)

Todos os campos são obrigatórios e campos extras são rejeitados.

| Campo | Tipo | Regra |
|---|---|---|
| `schema_version` | inteiro | 4 |
| `kind` | texto | `"sed"` |
| `event_id` | texto | 1 a 100 caracteres, único por cliente |
| `timestamp` | texto | ISO 8601 com fuso, ocorrência do evento, não pode estar mais de 300 s no futuro |
| `client_id` | texto | igual ao cliente da credencial |
| `group_id` | inteiro | grupo cadastrado do cliente |
| `contributor_token` | texto | 64 hexadecimais minúsculos; pseudônimo estável por cliente e ciclo, gerado pelo IAí |
| `debt_principal` | texto | código da dívida (tabela abaixo) |
| `debt_adjacent` | texto ou nulo | código da dívida, diferente de `debt_principal`; hipótese da matriz, oculta da empresa |
| `context` | texto | `conflito`, `decisao`, `alinhamento`, `feedback`, `crise` |
| `actor` | texto | `time`, `par`, `liderado`, `chefe`, `cliente` |
| `momento` | texto | `Antes`, `Durante`, `Depois`, `Padrao`, `Vazio` |
| `intensity_proxy` | texto | `Baixa`, `Media`, `Alta` |

### Códigos de dívida

| Código | Nome oficial | Apelido aceito | Quadrante |
|---|---|---|---|
| `evitacao_conflito` | Evitação de Conflito | | paralisia |
| `decisao_postergada` | Decisão Postergada | | paralisia |
| `comunicacao_ambigua` | Comunicação Ambígua | | retrabalho |
| `autoridade_fragilizada` | Autoridade Fragilizada | | retrabalho |
| `accountability_diluida` | Accountability Diluída | | retrabalho |
| `confianca_erosionada` | Confiança Erosionada | | cinismo |
| `aprendizado_bloqueado` | Aprendizado Bloqueado | | cinismo |
| `alinhamento_simbolico` | Alinhamento Simbólico | | cinismo |
| `energia_emocional_degradada` | Energia Emocional Degradada | Energia Emocional | ruptura |
| `maturidade_politica_insuficiente` | Maturidade Política Insuficiente | Maturidade Política | ruptura |

## Mensagem 2: resposta da pesquisa silenciosa (`kind = "survey"`)

| Campo | Tipo | Regra |
|---|---|---|
| `schema_version` | inteiro | 4 |
| `kind` | texto | `"survey"` |
| `event_id`, `timestamp`, `client_id`, `group_id`, `contributor_token` | | como acima |
| `question_id` | texto | `<código da dívida>.<1 a 3>`, por exemplo `decisao_postergada.2`; um dos 30 itens do banco |
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

O motor recebe agregados já liberados. Ele **não** calcula IEC com densidade abaixo do nível N2 nem a partir de um evento. Abaixo de N2 a resposta é "indisponível por maturidade". O motor só roda para clientes com `cre_enabled`; alertas exigem também `alerts_enabled`.
