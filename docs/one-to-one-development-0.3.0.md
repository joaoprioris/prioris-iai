# IAí — condução ao vivo e leitura interna, versão 0.3.0

## Escopo desta rodada

O 1:1 conduz conversas relevantes acontecendo agora: abertura, tensão, retomada
de foco/direção e fechamento, bilateral ou em grupo. Compromisso-alvo não é
pré-requisito de ajuda. Nome da reunião e estado Durante não selecionam agente.
Preparação de fala futura continua Feedback; comparação de alternativas, Mentor;
efeito humano, Impacto; risco imediato preserva Crises e apoio humano.

A leitura interna admite Antes, Durante, Depois, Padrão, Vazio e ausência de base.
É atualizada a cada troca, com citação do relato; não determina agente, não cria
diagnóstico e não é exposta na resposta. Citação válida demonstra origem, não
correção da interpretação. Vazio não implica incapacidade emocional.

A política, o contexto persistido e os controles de resposta usam 0.3.0.
Sessões preexistentes preservam sua contagem. Não foi executada migração de dados.
O antigo job `close_bilateral` não integra o novo contrato de classificação.

## Segurança e limites

- Router novo continua opt-in pelo controle existente; nenhuma variável global
  foi alterada. Esta mudança só atua numa instância autorizada do fluxo novo.
- Máximo de dez trocas na sessão inteira, inclusive perguntas de esclarecimento
  e transições. Fechamento antecipado mantém exigência de evidência do próximo
  passo, sem exigir compromisso. Fechamento final reconhece lacunas.
- Duas respostas com fechamento inválido na décima troca permitem recuperação
  explícita do servidor, sem inventar conclusão. Falha do provedor e evidência
  fabricada continuam erros, não sucesso.
- Evolução não é acionada como camada de fundo. O fluxo funcional não grava SED,
  dívida/adjacência estruturadas nem calcula IEC/DCO, Health Monitor/Risk Engine.
  A chamada de geração de SED do caminho legado foi desativada, sem apagar código
  ou registros antigos. A taxonomia de dívida ainda existe no código legado;
  não foi integrada ao piloto funcional nem validada nesta rodada.
- Identidade visual, imagens, autenticação, dados existentes e produção intactos.

## Testes locais e evidência

`node --test scripts/check-one-to-one.cjs` usa os componentes atuais e reutiliza
especificações históricas de serviço e condução, sem alterar seus originais.
`node --test scripts/one-to-one-provider.test.cjs` compila o adaptador atual em
memória, usa respostas SDK injetadas e substitui o banco por um componente que
lança erro se houver tentativa de conexão.

Os testes não chamam IA, não enviam e-mail e não usam banco real. Testam o
transporte e a aplicação de observações estruturadas; não classificam o texto
documental por IA nem aprovam semanticamente as respostas.

Saídas desta rodada: `generated-artifacts/one-to-one-0.3.0/`. Evidências anteriores
em `prioris-routing-consolidation-20261012/` permanecem inalteradas. Não se atribui
a esta execução a alegação de 92 testes da cópia local do proprietário.

Resultado executado em 13/10/2026: 73 testes de serviço/condução e casos focados
passaram; seis testes do adaptador real com SDK fictício passaram na execução
final (79 no total). A primeira execução do adaptador teve uma falha de recuperação
na décima troca; o relatório inicial foi preservado e o defeito corrigido. A
checagem TypeScript do servidor passou sem erros. O build e início do serviço de
desenvolvimento passaram; `/api/healthz` respondeu 200. A tela pública da prévia
local carregou o login; o chat autenticado não foi verificado visualmente.

## Como abrir posteriormente um piloto isolado, sem ativação global

Não iniciado nesta rodada. Reutilizar `createFunctionalRouter`, com:

1. Processo/porta separados e origem exclusiva, sem substituir o servidor público
   ou o caminho principal da prévia. A prévia principal usa seu serviço registrado;
   rodar outro servidor sozinho não muda o destino dela.
2. Repositório em memória com apenas empresa, pessoa e sessão fictícias. Se for
   necessário testar PostgreSQL, exigir banco separado confirmado como fictício;
   nunca reutilizar automaticamente `DATABASE_URL` ou dados públicos.
3. Autenticação local do piloto preservada, restrita à pessoa e empresa fictícias.
   Não usar `authorize` que simplesmente chama `next()`; não exibir tokens ou
   links na página ou nos registros. Desabilitar envio de e-mails nessa instância.
4. `enabled: () => true` somente na instância isolada; não definir
   `PRIORIS_FUNCTIONAL_ROUTING_V1=true` globalmente. Usar `origins` explícitas para
   a origem do piloto e preservar verificações de autenticação e origem.
5. Nesta fase, `classify` e `respond` injetados, determinísticos, claramente
   identificados como simulações. Teste semântico posterior com IA exige decisão
   separada; não usar o servidor antigo de piloto automaticamente, pois ele
   instancia provedores reais e contém lógica de troca de portas.

Sem prontidão de produção declarada. Além da restrição bilateral prescrita,
nenhuma nova regra metodológica foi escolhida. A passagem fornecida pelo usuário
é a base da correção; hashes e determinações dos documentos originais foram
preservados, não representam uma nova conferência dos arquivos remotos.
