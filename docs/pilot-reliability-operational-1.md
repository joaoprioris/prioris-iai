# Piloto IAí — confiabilidade operacional 1

## Estado e diagnóstico observado em 14/10/2026

Fluxo metodológico continua 0.3.4. Não foram alterados prompts, seleção de agentes,
lentes, guardrails, histórico pessoal, SED ou controles globais.
Documentos consultados: condução ao vivo 0.3.0 e orientação de autoria 0.3.3.
Esta revisão trata apenas de transporte, persistência e apresentação de estado.

Estado canônico: `generated-artifacts/pilot-campaign/state-v1.json`, rodada 19
ativa com duas respostas concluídas e uma tentativa falha. Não era mais uma
rodada vazia. Expiração original: 14/10/2026 09:29:05.037 UTC; não renovada.
Contabilizado US$4,253750; 168 chamadas observadas em 163 entradas de ledger.
Teto US$5; restante estimado US$0,746250. Reservas incertas US$0,759648 já
incluídas no contabilizado, margem antiga US$0,125091 mantida.
Isso não é saldo, fatura, tokens confirmados nem ausência de cobrança.

### Comprovado nos arquivos existentes

- Rodada 17: seis respostas; na contingência do terceiro turno, ambas as
  gerações passaram por ACCEPTED, mas falharam em RESPONSE_CONSTRAINT_FAILED.
  Houve resposta de contingência concluída, não indisponibilidade comprovada.
- Rodada 18: três respostas e abandono. Uma tentativa do terceiro turno falhou
  em UNSUPPORTED_FACT nas duas gerações, resultando em INVALID_MODEL_RESPONSE.
  Outra tentativa, turno 4, registrou MODEL_UNAVAILABLE.
- Rodada 19: duas respostas concluídas; tentativa do terceiro turno registrou
  MODEL_UNAVAILABLE. O ledger conserva uma reserva uncertain-held.
- Interface anterior removia o envio após erro e incentivava nova tentativa.
  Identificador pendente ficava apenas em memória; recarregamento o perdia.
- O serviço já gravava resultado antes de emitir SSE, mas a interface não tinha
  uma consulta de recuperação independente de nova execução.
- O bloco de geração também capturava erros de gravação como falha de modelo.
  Portanto MODEL_UNAVAILABLE histórico sozinho não identifica fornecedor.

### Lacunas

Não há causa de transporte suficientemente registrada que comprove timeout,
indisponibilidade no fornecedor ou motivo remoto nas falhas das rodadas 18/19.
Não foram feitas chamadas para investigar. Registros antigos não foram
reconstruídos ou alterados. Classificações e guardrails não foram reavaliados.

## Mudanças

- Recibo durável anterior à execução; mesma requisição recupera estado sem
  reclassificar ou gerar novamente. Conteúdo diferente com mesmo ID é recusado.
- GET autenticado `/api/pilot-0.3.0/delivery` recupera envios, respostas
  efetivamente concluídas e códigos; não usa campos internos como fala exibida.
- Envio conservado na aba como outbox fictício até confirmar recebimento.
  Não há repetição automática. Ausência de recibo bloqueia novo envio e orienta
  consultar o estado, em vez de assumir que a chamada não aconteceu.
- Desconexão não libera envio ativo. Reinício sem conclusão persistida marca
  INTERRUPTED_UNCONFIRMED e mantém reservas; não implica que o remoto parou.
- Falha de gravação desfaz alterações operacionais não confirmadas em memória,
  sem desfazer custos. Falha terminal de gravação é mostrada como incerteza.
- Reprovação de validação continua INVALID_MODEL_RESPONSE; exceções identificadas
  de armazenamento preservam STORAGE_UNAVAILABLE em vez de virar falha de modelo.
- Desistência usa confirmação na própria tela; continua abandono, não aprovação.
- Arquivamento inclui os novos recibos; nova identidade não recebe os anteriores.
  Autenticação, autorização, prazo e controles de orçamento continuam exigidos.

## Verificação executada

`scripts/pilot-reliability.test.cjs`: 11 testes aprovados
(10 iniciais e uma verificação adicional focada em classificação incompleta).
Inclui serviço simulado via HTTP, desconexão real do cliente HTTP durante espera,
replay, concorrência, gravação anterior à chamada e durante geração,
recuperação após reinício, sessão inválida e autenticação fictícia.

Seleção focada de `scripts/pilot-next-round.test.cjs`: 6 testes aprovados,
incluindo reservas conservadoras, abandono, origem/proprietário e avanço.
Checagens TypeScript da API e frontend aprovadas.
Nenhuma chamada real/paga foi realizada. Testes estruturados não comprovam
semântica, autonomia do líder ou disponibilidade externa.

## Evidência recuperável

Cópia anterior do estado e fontes em `generated-artifacts/pilot-reliability-preserved/`;
resumo e hashes em `generated-artifacts/pilot-reliability-result.json`.
Snapshots existentes e auditorias anteriores permanecem preservados.
Na tela: painel de confiabilidade, situação do envio, códigos e botão de consulta
sem nova chamada; confirmação de abandono inline.

## Limitações de acesso

Prévia continua em `/pilot-0.3.0`. Servidor precisa ser recarregado para executar
o novo código; autenticação proprietária em memória exige novo login após reinício.
A janela já expirou, portanto login/conversa reais continuam bloqueados.
Não foi renovada autorização nem contornado login. A página não autenticada e
API de estado podem ser verificadas; interação visual autenticada não foi
verificada nesta janela. Não é declaração de solução definitiva ou produção.
