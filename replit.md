# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Execução local sem Replit

Pré-requisitos: Node.js 24, pnpm 11 e PostgreSQL 16. O caminho local mantém a
autenticação por magic link, isolamento por usuário/organização, checagem de
origem, limite de dez trocas e os controles de histórico. Não existe login de
desenvolvimento nem usuário embutido.

1. Instale o lockfile: `pnpm install --frozen-lockfile`.
2. Copie `.env.local.example` para `.env.local` e use credenciais exclusivamente
   locais. `ANTHROPIC_API_KEY` é necessária somente para conversa real.
3. Crie um PostgreSQL vazio e descartável e aplique uma vez
   `psql -X -v ON_ERROR_STOP=1 -d iai_local -f lib/db/migrations/0001-baseline.sql`.
   A baseline nunca deve ser aplicada a banco existente. Cadastre a identidade
   fictícia local com `psql -X -v ON_ERROR_STOP=1 -d iai_local -v
   local_email=seu-alias-de-teste -f scripts/bootstrap-local.sql`. O script
   recusa outro nome de banco; não use dados de conversa reais na avaliação.
4. Para login pela interface, configure `AUTH_EMAIL_ENABLED=true` e as variáveis
   SMTP. O servidor não retorna tokens por API ou log.
5. Ative o orquestrador com `PRIORIS_FUNCTIONAL_ROUTING_V1=true` e execute
   `pnpm dev:local`. Interface: `http://localhost:5173`; API: porta interna 8080.

O launcher usa Node e o `npm_execpath` do pnpm ativo, sem comando de shell montado,
fixa `PRIORIS_AI_PROVIDER=anthropic`, encaminha `/api` pelo Vite e
permite cookie HTTP apenas quando `NODE_ENV=development`, `IAI_LOCAL_HTTP=true`
e `APP_BASE_URL` é loopback. Fora dessas três condições, HTTPS e cookie seguro
continuam obrigatórios. Nesse perfil API e Vite escutam somente em `127.0.0.1`;
fora dele preservam o bind remoto existente. Use `pnpm build` para build/typecheck e:

- `node --test scripts/local-feedback-eval.test.cjs` para avaliação sintética;
- `pnpm eval:feedback:list` para inventário rastreado (`S05` apoio canônico;
  `S11` casos de avaliação) e cobertura do lote atual: quatro conversas completas,
  quinze turnos e referência/origem preservadas;
- `pnpm eval:feedback:live` para o lote real, depois de definir as variáveis no
  ambiente do processo. A chave vem apenas de `ANTHROPIC_API_KEY`, sem leitura de
  arquivo; `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS` (mínimo 1200, padrão 3000)
  e `ANTHROPIC_EFFORT` são opcionais e devem corresponder ao modelo;
- `pnpm exec tsx --test scripts/local-runtime.test.ts` para origem/cookie e falha
  injetada do provider, além do bind efetivo de API/Vite, sem chamada de modelo.

O lote usa `maxRetries: 0`, interrompe após erro de uso incerto e registra tokens
da resposta antes de aceitá-la ou rejeitá-la. Blocos `thinking` e
`redacted_thinking` não são exibidos nem gravados; `tool_use` inesperado continua
recusado. Cada correção de código exige repetir as regressões e o lote completo;
isso não é fine-tuning nem aprendizagem automática.

Sem chave Anthropic, a validação estrutural funciona, mas conversa real permanece
pendente. Nenhum comando de setup faz chamada de modelo, aplica deploy, altera o
piloto preservado ou redefine seus limites.

## Dependências Replit identificadas

- `.replit` e `.replit-artifact/`: módulos, portas e metadados de publicação;
- plugins Cartographer, dev banner e runtime error modal: carregados pelo Vite
  somente quando `REPL_ID` existe; permanecem no lockfile para compatibilidade;
- provider `replit`: usa `AI_INTEGRATIONS_ANTHROPIC_*` apenas quando selecionado;
- `REPLIT_DEV_DOMAIN`: origem adicional apenas no ambiente Replit.

O perfil local não depende de Replit Agent, publicação ou integração de modelo
do Replit. Ele reutiliza o SDK Anthropic e a mesma API Node/TypeScript existentes.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.


## Estado verificado — 18/10/2026: Feedback fora do Replit

PR2 permanece aberto, sem merge ou deploy. A API própria foi conectada por credencial apenas em memória; nenhum segredo consta do código ou deste registro.

Causas reproduzidas: (1) basisEvidence era opcional no esquema, mas obrigatório para a abertura no validador; (2) uma cópia integral do exemplo em text causava DUPLICATE_DELIVERY e nova geração; (3) “apresentei” na fala proposta do líder era confundido com alegação de histórico do assistente.

Correções: arrays de evidência obrigatórios no esquema; normalização exata da cópia integral para campo separado, sem reescrita semântica; distinção explícita de autoria no verificador de histórico. Base factual e demais limites permanecem verificados. Escopo orienta responder ao pedido atual e preservar o objetivo. Metodologia de AGENTES não foi alterada.

Verificação: 15/15 regressões passaram; o caso capturado falhou antes com DUPLICATE_DELIVERY e depois com UNSUPPORTED_FACT, demonstrando também a confusão de autoria. Compilação do executor passou. O executor reutiliza createConversationService e createModelProviders reais, classificação, geração, validação e reparo. Armazenamento em memória: não valida HTTP/login/PostgreSQL/SED.

Consumo acumulado estimado das chamadas registradas: US$0.871577; 28 chamadas ao modelo. A contagem prévia de tokens permite reserva conservadora dentro de US$1 acumulado. Sem retry após uso incerto. Isso não representa extrato de cobrança.

### Conversa de referência completa, anterior às correções finais

**Líder:** Quero preparar um feedback para uma pessoa da equipe. Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta. Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.

**IAí:** Você quer abrir espaço para entender o contexto e alinhar a dinâmica daqui para frente. Duas interrupções em uma reunião específica podem significar urgência, discordância ou apenas uma diferença de ritmo — você ainda não sabe.

A tensão está entre nomear o que te chamou atenção e preservar condições para uma conversa aberta, sem fazer da interrupção o problema central antes de ouvir.

Como você pretende abrir essa conversa com ela?

**Líder:** Pode me dar uma abertura curta e adaptável?

**IAí:** Uma opção é nomear o fato observável — as duas interrupções na reunião de ontem durante sua explicação — e explicitar sua dupla intenção: ouvir o contexto dela e alinhar como vocês vão conversar nas próximas reuniões. Você pode ajustar o tom e as palavras conforme sua relação e o ambiente.

Exemplo opcional para revisar sua abordagem:
“Ontem na reunião, você me interrompeu duas vezes enquanto eu explicava a proposta. Quero entender o que aconteceu e combinar como a gente se organiza daqui pra frente.”

**Líder:** Quero manter a fala só nas duas interrupções, sem supor o impacto. Pode deixar a abertura mais natural, sem tom de acusação?

**IAí:** Você pode nomear o fato observável — as duas interrupções na reunião de ontem — e abrir espaço para ouvir o contexto, sem atribuir peso ou supor impacto antes da conversa. O tom busca curiosidade em vez de acusação.

Exemplo opcional para revisar sua abordagem:
“Ontem na reunião, percebi que você me interrompeu duas vezes enquanto eu falava. Queria entender o que aconteceu.”

**Líder:** Pode encerrar por aqui.

**IAí:** Você preparou uma abertura que nomeia o fato observável — as duas interrupções na reunião de ontem — sem supor impacto, intenção ou tom de acusação. A abertura preserva espaço para ouvir o contexto da pessoa e mantém condições para uma conversa produtiva. O alinhamento sobre as próximas reuniões ficou em aberto, podendo ser conduzido a partir do que ela trouxer na conversa.

Realizar a conversa com a pessoa da equipe usando a abertura preparada, ouvir o contexto dela e, conforme o andamento, propor o alinhamento sobre a dinâmica das próximas reuniões. Você pode voltar ao IAí caso precise ajustar a abordagem ou preparar outro trecho da conversa.

Exemplo opcional para revisar sua abordagem:
“Ontem na reunião, percebi que você me interrompeu duas vezes enquanto eu falava. Queria entender o que aconteceu.”

Podemos retomar o próximo passo em uma nova conversa.

### Verificação real final da abertura — uma solicitação, não uma conversa completa

**Líder:** Quero preparar um feedback para uma pessoa da equipe. Na reunião de ontem, ela me interrompeu duas vezes enquanto eu explicava uma proposta. Quero ouvir o que aconteceu e combinar como vamos conversar nas próximas reuniões.

Pode me dar uma abertura curta e adaptável?

**IAí:** Você quer entender a razão da interrupção e construir um acordo de conduta para as próximas reuniões. Uma abertura possível:

Exemplo opcional para revisar sua abordagem:
“Ontem você me interrompeu duas vezes enquanto eu apresentava a proposta. Quero entender o que aconteceu e combinar como a gente conversa nas próximas reuniões.”

Referência da versão executada (SHA-256 dos fontes): 5e17ca4ed9bfd9f6d6facb372a4672a6dff49661d157038de2f12192ba89254c

### Próximo passo e limites

A abertura final foi aceita sem reparo, em duas chamadas (classificação e resposta). Nenhuma conversa integral da revisão final foi aprovada. Próximo passo: completar uma conversa adaptativa nessa revisão, incluindo pedido de ajuste, correção quando pertinente e encerramento; depois verificar casos distintos da biblioteca. Não ampliar ou hospedar como produto validado. O Engenheiro IAí respondeu limite de uso na última tentativa.

Comandos: `PRIORIS_AI_PROVIDER=anthropic` e chave apenas no ambiente do processo; `node scripts/evaluate-feedback-live.mjs --scenario fbk-peer-interruption-correction` para conversa completa; acrescente `--request-only` para diagnóstico de uma abertura; `--check-pipeline` verifica imports sem chamada; `--list` inventaria cenários. IAI_EVAL_STATE aponta para uso local sem chave. Estado e código canônicos estão neste PR; compilados e registros locais são temporários.
