# Piloto 0.3.1 — correção delimitada após primeira conversa

## Diagnóstico comprovado da rodada 1 (0.3.0)

O estado local preserva exatamente as quatro mensagens T1/T2 informadas pelo
avaliador, duas trocas e rota Crises em ambas. A conversa continuava `active` no
servidor; a desistência foi informada pelo usuário, não um fechamento funcional
exercitado. Histórico usado: falso. Leitura de situação final: sem base ancorada.

| Chamada | Modelo | Entrada | Saída | USD estimado |
| --- | --- | ---: | ---: | ---: |
| T1 | claude-haiku-4-5 | 2558 | 348 | 0,004298 |
| T2 | claude-haiku-4-5 | 2768 | 341 | 0,004473 |
| Total | Duas classificações, nenhuma geração Sonnet | | | 0,008771 |

As respostas foram geradas pelo ramo fixo organizacional do servidor, não pelo
modelo de geração. O seletor aceitava o booleano de risco com evidência apenas
não vazia. O ramo fixo repetia a mesma pergunta e acrescentava orientação física,
inclusive após correção do líder sem ameaça física relatada.

**Observações estruturadas originais não disponíveis:** o SDK retornava o JSON
de classificação, mas o serviço não o persistia nem o registrava em log.
Pelo ramo executado é possível deduzir, para ambas as trocas:
`immediateExternalRisk=true`, `riskKind=organizational` e `riskEvidence` não vazia.
Isso é dedução do código e da saída, não recuperação dos JSONs.
Não se conhece o conteúdo dessa evidência, job, confidence ou os demais campos.
Não se refez nenhuma classificação e não se preencheu essa lacuna por hipótese.

O snapshot original, incluindo transcrição, contexto e custo, permanece em
`generated-artifacts/pilot-0.3.0-round-1-preserved/state.original.json`.
SHA-256 original:
`82dba98a89cf4ea6f08c547f931d5771a37f96c0922e7f0b24043970cb504cf3`.
Fontes relevantes e especificação anterior de testes também preservadas.

## Correção de desenvolvimento 0.3.1

- Observação técnica `riskBasis` diferencia ameaça/dano concreto e imediato,
  mera incerteza e base insuficiente. Não é questionário, score ou metodologia.
- Prioridade de Crises exige qualificação concreta e citação de fala do usuário;
  evidência não pode vir da resposta anterior do IAí. Apenas estar numa reunião,
  precisar responder ou haver informação divergente não ativa essa prioridade.
- Sem base sustentada de risco imediato, a seleção continua pela necessidade
  funcional dominante. Não se força 1:1: comparação de alternativas pode ir ao
  Mentor, preparação futura ao Feedback e compreensão de efeito humano ao Impacto.
- Classificação reavalia a correção atual, sem usar a resposta passada como prova
  de dano. Os cinco estados não escolhem agente.
- Risco organizacional concreto utiliza geração pela função documentada de
  Crises, em vez da resposta fixa de emergência física. Proteção imediata para
  ameaça física explicitamente relatada foi preservada.
- Sem base física pertinente, as instruções de resposta vedam acrescentar
  afastamento físico ou emergência física. Incerteza não autoriza inventar data,
  execução, culpa, política ou obrigação.
- Na rodada 2, observações de classificação, leitura de risco/estado, rota e
  resultado são registrados no arquivo isolado de diagnóstico, inclusive a
  classificação quando a geração falha. Não são retornados como histórico pessoal,
  usados na rodada seguinte ou registrados em logs públicos.
- Documento/contrato original dos agentes, fórmulas e lentes não foram alterados.

**Limite da correção:** citação exata demonstra origem; o qualificador continua
dependendo da interpretação do modelo. Nem citação nem teste determinístico
comprovam que uma ameaça realmente existe ou que a classificação está correta.
As respostas usadas nos testes locais são fixtures, não novas respostas reais
para este caso. O reteste independente permanece necessário.

## Segunda rodada limpa e teto conjunto

Mesmo endereço de desenvolvimento `/pilot-0.3.0`, agora identificado na interface
como versão 0.3.1, rodada 2. Reentrar com a conta Replit do proprietário após o
reinício. A autorização continua sem e-mail do app e sem copiar credenciais.

Outro líder e outra empresa, ambos fictícios, com nova conversa, contagem zero,
sem mensagens anteriores, sem histórico pessoal e sem camada organizacional.
Somente essa conversa pode ser acessada pela identidade da rodada 2.

O orçamento superior permanece US$1 **acumulado** nas duas rodadas. A segunda
herda US$0,008771 e as duas chamadas já contabilizadas; não duplica nem zera esse
custo. Cada chamada futura recebe reserva completa, incluindo saída máxima e
recuperação, pelos controles existentes. Reinício não renova gasto, contagem ou
prazo. O prazo de duas horas foi aberto uma vez para a rodada 2; cada conversa
admite no máximo dez trocas, inclusive transições.

Nenhuma nova conversa/mensagem ou chamada real é criada antes da interação do
proprietário. Se o ledger real desaparecer, o servidor bloqueia em vez de criar
outro orçamento zerado. Inicialização vazia existe apenas para fixtures injetadas
nos testes. Arquivos de rodada atual e preservada são negados pelo Vite.

## Verificações executadas

- 24 testes locais aprovados: 11 específicos da correção, sete controles do
  piloto e seis regressões do adaptador.
- Abrangem a flag indevida, evidência não ancorada, risco físico, crise
  organizacional, atualização do contexto, fronteiras, observações após falha,
  transcrição/custo preservados, outro escopo sem histórico, teto conjunto,
  isolamento/autorização, dez trocas e contagem sem reinício.
- TypeScript de servidor e frontend aprovado.
- Build/início de desenvolvimento aprovados. Status observado HTTP 200 com
  versão 0.3.1, rodada 2, estimado US$0,008771, restante US$0,991229 e duas
  chamadas acumuladas. Zero chamadas da rodada 2 e nenhuma sessão nova criada.
- Snapshot preservado confere com o SHA-256 original e com o original arquivado
  no estado migrado. A tentativa de servi-lo pelo Vite respondeu 403.
- Captura da entrada confirma o aviso de versão/rodada e orçamento acumulado.
- A checagem complementar `git diff --check` não concluiu: a proteção do
  ambiente bloqueou acesso a `.git/index.lock`, mesmo com locks opcionais
  desativados. Não se forçou permissão nem se alterou Git para contornar isso.
- Relatórios: `generated-artifacts/pilot-0.3.1-verification/`.
- Nenhuma chamada de IA, e-mail ou escrita no banco normal/produção nos testes.
- Não há validação semântica por IA nem declaração de prontidão de produção.

SED, dívida/adjacência estruturadas, IEC/DCO, Health Monitor/Risk Engine e
Evolução continuam desativados. Router global permanece desligado; sem publicação.
