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
| I | Habilitação por contrato | **O Risk Engine roda sempre, para todo cliente; o cliente não precisa saber que ele existe.** A tabela `client_entitlements` (contrato de 6 ou 12 meses, `cre_client_visible`, `alerts_enabled`) controla só o que o cliente enxerga: o módulo e os alertas dirigidos ao RH. Alerta ao cliente exige o módulo visível. Alerta azul é interno e não depende disso. Política comercial (gratuidade, prazos, o que vale depois dos 6 meses) ainda será estruturada pelo proprietário e fica fora do código; entra como dado administrativo |
| L | Adjacência | A adjacência **é registrada em todo SED** (`debt_adjacent`, hipótese da matriz). O motor a usa **internamente** para detectar pares (principal, adjacente) que se repetem ciclo após ciclo no mesmo grupo, sinal de uma dívida possivelmente se convertendo em outra, base de análise preditiva. **Nada disso é apresentado ao cliente** até haver certeza de que as dívidas realmente se correlacionam e se alimentam. Implementação: função `adjacency_release()` (só o papel do motor, mesma supressão de 3 participantes distintos) e `emergingPairs`/`trackPairs`, sem valores padrão (o limiar de recorrência é decisão do proprietário). A adjacência antecipada nunca soma à contagem da dívida adjacente |
| J | Glossário | O SED é **Structured Event Data** (o Doc 3 diz "Sinais Estruturais de Decisão", a corrigir). Valores de `actor` seguem o MESTRE: `time, par, liderado, chefe, cliente` (o Doc 3 e a Metodologia Completa dizem `pares` e `líder`) |
| K | Individual x organizacional | O Health Monitor Individual (custos pessoais do líder) tem dados separados, acesso só do líder e nunca entra no pipeline organizacional. **Não está neste contrato.** Quando for implementado, exige tabelas, papéis e funções próprios; nenhuma tabela deste esquema pode ser reaproveitada |

Decisões do proprietário já registradas na pasta IMPLEMENTAÇÃO (registro de divergências, D01 a D12, 15/10/2026) e que este contrato segue:

- **D05:** o momento do SED tem cinco opções (Antes, Durante, Depois, Padrão e Vazio). Nada é convertido.
- **D07:** a intensidade tem três usos distintos e **não há conversão direta entre eles**: intensidade proxy do SED (Baixa, Média, Alta), saída categórica do Health Monitor (1, 2 ou 3) e I_d do IEC (0 a 1, quatro dimensões). Cada etapa documenta como suas evidências alimentam a seguinte, sem reaproveitar o mesmo campo como se fossem a mesma grandeza. O motor recebe I_d pronto, derivado pelo Risk Engine, e nunca a intensidade proxy.
- **D08:** IEC v1.0 é a versão atual; curva logística e pesos dinâmicos são evolução futura e não estão ativos.
- **D10:** o motor calcula e a matriz mostra **todas as dez dívidas**. Dado insuficiente não é zero nem zona verde. Não existe limite de três vermelhas, de três cálculos ou de três itens exibidos no motor, no banco ou na visualização. O Top 3 é um recorte comercial da entrega. (`rankAll` ordena as dez; `top3` é só o recorte.)
- **SED sem confiança:** não se registra SED enquanto não houver confiança suficiente, e candidato provisório não contorna a regra.

Pendências que **não** foram decididas e portanto não estão no código:

- **Tipo de decisão** (campo do MESTRE e da Interação User x IAí): é fragmento de decisão trabalhado. Em texto livre vazaria conteúdo da conversa. Só entra quando houver lista fechada de valores (D05, detalhes).
- **Obrigatoriedade e ausência dos campos do SED, e evidências para alta confiança** (D05): as listas de campos diferem entre os documentos.
- **Adjacência** (D06): falta explicitar se uma associação secundária é um sinal observado, distinto da adjacência futura. Há também conflito de exibição: o Doc 3 veda mostrar a adjacência à organização e o Manual de Auditoria a inclui no relatório. Aqui a adjacência fica oculta da empresa.
- **Contrato numérico do IEC** (D09): normalização de R quando f/T passa de 1 (o motor limita a 1), duração e fronteiras dos ciclos, desempate e arredondamento, cortes entre 39 e 40 e entre 69 e 70 (o motor corta o valor sem arredondar), divisor 10 do IEC global quando pi varia.
- **T da recorrência:** o Doc 2 define T como o número de ciclos observados no período. O motor usa T = 20 (baseline que reproduz o ensaio de 11/10/2026). A troca muda os resultados do ensaio.
- **Elegibilidade e maturidade** (D11): denominador da taxa de resposta, consolidação de grupos pequenos (este contrato suprime), saídas permitidas por nível e condições de antecipação.
- **DCO** (D12): a proposta de coleta e estimação não foi aprovada. Insumos R, T, P, C vêm do cliente; o motor calcula o DCO por dívida e **não soma** as dívidas, porque a mesma perda não pode ser contada duas vezes e ainda não há regra de duplicata.
- **Matriz de interdependência M (10x10):** proprietária e ausente dos documentos. O motor recebe a soma ponderada dos IEC adjacentes já calculada.
- **Limiar de "ocorrência relevante" para o amortecimento A:** o motor usa `f > 2`, regra do ensaio sem fonte nos documentos oficiais.
- **Alerta azul:** depende do limiar de consolidação (θ), ainda não definido.
- **Pesos das perguntas (R, I, I+):** o Doc 6 define os fatores 1,5, 1,0 e 0,3, mas nenhum documento diz qual pergunta tem qual peso.
- **Detecção de deriva** (Doc 6, 4.5) e **critério de IEC estável** (para o N4): sem definição numérica.
- **Passivo jurídico (NR-1)** no demonstrativo: o Doc 1 (9.8) diz que não estabelece data de vigência e a Metodologia Completa diz "em vigor desde maio de 2026". Exige validação jurídica antes de aparecer em produto.

Fora do escopo desta implementação e registrado para a etapa do emissor (EX11): auditoria técnica de abstenção, separada do SED, para quando a confiança for insuficiente (sem armazenar dívida conjecturada); e o risco SEG12, de que `session_id` ou vínculo de sessão em SED e survey permita reidentificar (aqui só existe o token pseudônimo por cliente e ciclo, e a supressão mínima de 3 participantes distintos).

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

O motor recebe agregados já liberados. Ele **não** calcula IEC com densidade abaixo do nível N2 nem a partir de um evento. Abaixo de N2 a resposta é "indisponível por maturidade". O motor roda para todos os clientes; o que o cliente vê depende de `cre_client_visible`, e alertas ao cliente exigem também `alerts_enabled`.
