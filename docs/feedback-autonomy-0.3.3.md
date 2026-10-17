# IAí 0.3.3 — autoria do líder e rodada 4

## Decisão explícita do proprietário

“é provocar o líder, trazer clareza pra ele e perguntar como ele pretende dar o feedback”

“senao o lider nao se desenvolve e fica viciado... nao eh a intenção”

Aplicação autoritativa no Feedback: desenvolver julgamento e autoria, não entregar
fala pronta como objetivo padrão. A permissão para frases/exemplos não é obrigação.
O proprietário informou os blocos canônicos e de interação que sustentam essa
orientação; não foram inventadas fórmulas, lentes ou funções para completá-la.
O contrato anterior de implementação enfatizava “mensagem utilizável”; a nova
instrução autoritativa o subordina ao desenvolvimento do líder, preservando sua
função de apoiar comunicação e os originais metodológicos.

Reconhecer momento/tensão, ampliar leitura pertinente, explorar abordagem e mudança
que o líder quer construir. Trabalhar sua elaboração, questionar lacuna real e
suposições com respeito; sem sequência obrigatória de perguntas ou ajuda vazia.
Exemplo opcional apenas apoia elaboração existente, com origem e propósito de
revisão registrados. Não assumir decisões, execução, compromisso ou efeitos não
relatados. Não moralizar receio nem garantir proteção da relação pela clareza.
Proteção a perigo físico permanece fora dessa restrição de exemplos do Feedback.

## Implementação e fidelidade técnica

- O caminho real de geração carrega um único escopo operacional de Feedback,
  derivado do contrato canônico: papel, entradas, ajuda, limites e conclusão.
  Ele proíbe títulos mecânicos, detalhes/impactos inventados e defesa de leitura
  corrigida; pedido de abertura não significa encerramento.
- A biblioteca distingue o apoio canônico `S05:example:P0066-P0073` dos 90
  momentos de avaliação `S11`. O lote focal cobre três conversas completas, com
  origem e referência `S11:P0067-P0069`; repetição não é tratada como treino.
- O avaliador Anthropic local recebe chave/modelo apenas pelo ambiente, não cria
  rota, não repete uso incerto e contabiliza tokens inclusive na resposta
  recusada. `thinking` privado é descartado; formato inesperado segue recusado.
- Instrução autoritativa ao modelo e controle interno de autoria específico do
  Feedback: explore/review/optional_example não são roteiro exibido ao líder.
- O pedido direto de uma abertura breve é reconhecido pelo ato de pedir e pelo
  objeto pedido, sem palavra-senha adicional como “adaptável” ou “formular”.
  Negativas, retirada, pedido citado de terceiro e roteiro completo continuam
  fora dessa autorização.
- Afirmação causal exibida exige proveniência afirmativa. Negação fiel e hipótese
  identificada permanecem permitidas; a negação de outro sujeito em uma oração
  anterior não muda a polaridade da causa afirmada pelo líder.
- Delivery não é automático; exemplo exige elaboração fonte do líder e propósito
  de revisão. Sem elaboração, apoiar sua construção sem redigir por ele.
- Mapas explícitos relacionam userMessage (índice do líder) com conversationMessage.
- Citação exata com índice errado só é recuperada quando a origem é inequívoca.
  Aspas e espaços só normalizam apresentação; recorte exato original é preservado.
  Não há aproximação semântica, troca de palavras, fonte do assistente como critério
  ou recuperação de ambiguidades.
- Bruto não é mutado: normalizações registram referência original, referência
  resolvida, papel/fonte e motivo. Fonte correta já explicitamente indexada continua
  válida sem recuperação; fonte ambígua sem referência válida permanece recusada.
- Delivery literal já presente não é acrescentado outra vez; repetições integrais
  são compostas uma vez e a normalização é registrada, sem gastar recuperação.
- Afirmações de impacto no Feedback usam proveniência afirmativa. Negação ou
  dúvida que mencione planejamento não é confirmação de prejuízo. O falso positivo
  do controle lexical anterior foi substituído, não removido para aprovar conteúdo.
- Apenas no piloto: objetos brutos de classificação/geração, normalizações,
  estágios/entrega e eventos com códigos de validação são persistidos. Falha final
  fica registrada sem incrementar a troca. Privacidade e histórico do app normal
  não foram alterados; nada disso vira rótulo visível ao líder.

## Preservação da rodada 3

`generated-artifacts/pilot-0.3.2-round-3-preserved/` contém estado original e fontes.
SHA-256:
`73a1ce11d141373c0adef770b15994d7dd8336b8eae0820afdc2535b5d987e81`.
O original arquivado na rodada 4 confere integralmente. Mantidos 20 registros de
chamada e US$0,334413. Desistência foi informada pelo usuário; a sessão antiga
continua active/3 no original, não foi transformada em fechamento funcional.

Os códigos das recusas da rodada 3 não foram registrados originalmente. A
validação determinística feita na inspeção anterior confirmou os códigos, mas não
é log histórico de execução. Não houve IA para reconstruir o passado. Lacunas da
rodada 1 e dos objetos de geração da rodada 2 também permanecem explícitas.

## Verificações executadas nesta alteração

Validação local posterior, em branch separada da rodada 4: `node --test
scripts/local-feedback-eval.test.cjs`, oito casos sintéticos aprovados. Cobertura:
sucesso, ambiguidade, abertura solicitada, negativas/pedido citado/roteiro,
correção causal, hipótese, encerramento sem pergunta e falha injetada do provider
sem commit nem fallback. O guard causal novo recebe explicitamente o agente e
fica inativo fora do Feedback. Esses candidatos
determinísticos não são conversa real com modelo e não aprovam qualidade
semântica.

- 13 testes focados aprovados, com SDK injetado e banco negado/em memória.
- Seis regressões locais existentes do adaptador passaram no mesmo ciclo de
  trabalho; não são aprovação do Feedback pelo critério de autonomia.
- Cobertura: referências/aspas/espaços de T3/T4 preservados, ambiguidade e fonte
  indevida recusadas, deduplicação, elaboração sem fala pronta, exemplo opcional,
  impacto negado, fechamento sem execução, códigos/brutos/normalizações,
  isolamento, custo acumulado/recuperação e proteção física.
- TypeScript de servidor/frontend passou. API compilou/iniciou e frontend iniciou.
- Página e API de status responderam HTTP 200: 0.3.3, rodada 4, available true,
  sem autenticação exercitada pelo agente, nenhuma sessão nova/chamada da rodada 4.
- A primeira execução teve erro de sintaxe no novo teste, corrigido. A execução
  intermediária detectou o falso positivo de impacto e uma expectativa incorreta
  de texto no teste físico. Relatórios mantidos; a proteção física não foi mudada.

Relatórios: `generated-artifacts/pilot-0.3.3-verification/`.
Testes de interpretação anteriores não devem ser apresentados como aprovados por
autonomia: o foco anterior em conseguir fala pronta era inadequado. A reavaliação
das respostas anteriores por esse critério é separada e não foi concluída aqui.

**Limites:** validações determinísticas não avaliam plenamente julgamento,
protagonismo ou pertinência semântica. A qualidade da elaboração e da evidência
continua dependendo da interpretação do modelo. Não há aprovação semântica nem
prontidão de produção; a rodada independente não foi antecipada pelo agente.

## Acesso e limites da rodada 4

https://4ba82eb6-87ce-4b44-8498-2461103c0175-00-hcati2mi4zau.riker.replit.dev/pilot-0.3.0

Reentrar pelo botão Replit, com conta do proprietário. Nova identidade/empresa
fictícias, contexto vazio, uma conversa, até dez trocas globais sem reinício em
transições. Histórico pessoal desligado, camada organizacional ausente.
Janela nova até 13/10/2026 05:03:31 UTC; reinício não a renova.
Teto estimado acumulado US$1; gasto US$0,334413; restante US$0,665587, sem reset.
Cada chamada/recuperação mantém reserva conservadora de entrada e saída máximas;
o teto pode bloquear antes de dez trocas. Não é saldo nem faturamento garantido.

Nenhuma chamada real, aquecimento, compra, e-mail, publicação ou escrita no banco
normal/produção foi executada pelo agente. Serviços de desenvolvimento continuam
ativos; router global e camadas pendentes não foram habilitados.

### Uso pela interface durante a finalização

Após a verificação de disponibilidade, a rodada 4 começou a ser utilizada.
Última leitura de metadados: duas trocas completas, duas classificações novas
contabilizadas em US$0,005604 e US$0,005888; acumulado US$0,345905, 22 chamadas,
restante estimado US$0,654095. Não foram falas/calls de aquecimento ou teste
enviadas pelo agente. O gasto de US$0,334413 foi herdado integralmente.
A captura da entrada, feita entre essas leituras, mostra US$0,340017/21 chamadas.
Esses são registros em momentos diferentes, não reset ou divergência do ledger.
Não foi inspecionado o conteúdo do novo caso para escolher correções nem
interrompida a conversa em andamento. Valores podem aumentar com seu uso posterior.
