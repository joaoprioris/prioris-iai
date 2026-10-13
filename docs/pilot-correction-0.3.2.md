# Piloto 0.3.2 — fidelidade após rodada 2

## Evidência preservada e diagnóstico

Inspeção exclusiva dos registros fictícios existentes; nenhuma reexecução de IA.
A rodada 2 continha três classificações normalizadas completas, três respostas
entregues e seis chamadas (três Haiku, três Sonnet), sem recuperação adicional.
T1: conduct_live → OTO, risco não imediato, Durante, sessão ativa.
T2: conduct_live → CRS, hipótese de risco concreto baseada na divergência anterior
e ownClarityImpaired sem evidência própria qualificada, Durante, sessão ativa.
T3: conduct_live → OTO, uncertainty_only, Durante, sessão fechada na terceira
resposta mesmo com decisionSufficientlyClear falso. A aceitação posterior relatada
pelo participante não foi uma quarta mensagem do produto.

O qualificador/citação de risco podia usar qualquer fala anterior. A flag de
incapacidade não exigia evidência própria. Os controles de geração não impediam os
compromissos de prazo, a preferência de data sem viabilidade nem a entrega
duplicada. O fechamento dependia do critério next e apagava o contexto com
histórico desligado. O piloto só copiava o resultado público, não a geração.
Isso explica a lacuna de estágios; não recupera os campos que não foram gravados.

Snapshot byte a byte e fontes anteriores:
`generated-artifacts/pilot-0.3.1-round-2-preserved/`.
SHA-256 do estado original:
`522f14760705fbcd2533f9381eba82a7fb3da60ef955914c2de9fbf8f2e3b3d1`.
O original inteiro também foi arquivado na migração da rodada 3.
As classificações brutas da rodada 1 e os objetos de geração da rodada 2
continuam indisponíveis. Nenhum objeto foi fabricado para preencher essas lacunas.

## Correção delimitada

- Prioridade de risco requer citação da fala atual e evidência relatada da própria
  ameaça/dano, não só do cenário. Correção atual não mantém citação antiga como
  prova. Riscos físicos e organizacionais pertinentes continuam priorizados.
- Contenção requer base qualificada de reação/sobrecarga própria impedindo
  julgamento e citação atual. Informação desconhecida/urgência não basta.
- Nenhum seletor por palavras-chave, nome de caso ou correspondência dívida-agente.
  A necessidade funcional continua escolhendo Mentor, Feedback, Impacto, 1:1 etc.
- Instruções da geração proíbem supor viabilidade, horário, aceitação ou execução;
  propostas condicionais devem ser opcionais e compatíveis com os fatos.
- Controles de saída rejeitam padrões de compromisso de data/retorno/validação
  sem proveniência, escolha de preferência sem viabilidade relatada, alegação de
  execução e de opções passadas sem origem na conversa realmente exibida.
  Esses controles de linguagem são de fidelidade da saída, não de seleção de agente.
- O resumo recebe apenas a conversa exibida; os campos internos não são histórico.
  A fala de delivery não pode repetir o texto visível; tentativa inválida usa a
  recuperação existente, também sujeita à reserva de orçamento.
- Fechamento antecipado admite critérios pendentes; não exige concluir next,
  coletar todos os critérios nem compromisso-alvo. Deve apresentar síntese, lacunas
  e próximo movimento sustentado.
- Somente no repositório do piloto: mensagens fictícias usadas, geração estruturada
  de cada tentativa (antes da validação), resposta normalizada, estágio, critérios,
  síntese, próximo passo, entrega e vínculo com chamadas do ledger são preservados
  separadamente do contexto. Nada disso é exposto como rótulo ao líder.
- O app normal não ganhou histórico: seu contexto ainda é eliminado ao fechar com
  histórico pessoal desligado. Observadores são opcionais, injetados só no piloto.
- Contratos dos agentes, metodologia, fórmulas e lentes não foram modificados.

## Verificações locais

18 testes aprovados: 12 focados nesta correção e seis regressões do adaptador
existente. SDK inteiramente injetado; banco negado no adaptador; estado de teste
em memória. Cobertura: falhas observadas, risco real/correção atual, base emocional,
fronteiras, compromisso/histórico sem origem, duplicação, recuperação, fechamento
com pendências, retenção de geração após fechamento, isolamento, teto cumulativo e
dez trocas. TypeScript do servidor e frontend aprovado.

Relatório: `generated-artifacts/pilot-0.3.2-verification/local-tests.log`.
Não foram executadas baterias históricas extensas, e as evidências anteriores
permanecem preservadas.

**Limitações:** citações e qualificadores não validam semanticamente a hipótese.
Os controles de linguagem cobrem padrões, não toda paráfrase possível. Os testes
não confirmam interpretação real pelo modelo nem aprovação metodológica ou
prontidão de produção. O reteste independente ainda é necessário.

## Rodada 3 disponível

Mesmo caminho `/pilot-0.3.0`, interface identifica 0.3.2/rodada 3.
Os serviços existentes do frontend e API foram reiniciados uma vez após o lote.
Página e status responderam HTTP 200. Status: available true, autenticação ainda
não exercitada pelo agente, nenhuma sessão nova, zero chamadas da rodada 3.
Conta Replit do proprietário autoriza uma terceira identidade/empresa fictícias;
reentrar pelo botão da interface, sem copiar credenciais ou usar e-mail do app.
Conversa vazia, até dez trocas, sem caso escolhido, histórico pessoal desligado e
camada organizacional ausente.

Teto conjunto: US$1 estimado. Mantidos exatamente US$0,097084 e oito chamadas;
restante estimado US$0,902916. Reservas completas e recuperação permanecem sob o
mesmo ledger. Não é saldo nem garantia de faturamento. Nova janela da rodada 3:
até 13/10/2026 04:26:23 UTC; reiniciar não a renova.

URL observada:
https://4ba82eb6-87ce-4b44-8498-2461103c0175-00-hcati2mi4zau.riker.replit.dev/pilot-0.3.0

Sem publicação, habilitação global, chamadas de aquecimento/provedor, e-mails,
compras ou escrita no banco normal/produção. SED, IEC/DCO, Health Monitor/Risk
Engine e Evolução não foram ativados.
