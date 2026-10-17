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
