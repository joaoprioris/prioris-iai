# @workspace/review

Ingestão do SED e da pesquisa silenciosa, publicação de agregados e motor do IEC como funções puras. Contrato em `docs/restart/sed-ingestion/CONTRATO.md`.

Estado: referência testada localmente. Não há nuvem, fila gerenciada, rotação de chaves, retenção nem ligação com o IAí. Nenhum SED real é gravado.

## Conteúdo

- `sql/`: esquema, papéis e permissões mínimas (PostgreSQL 15 ou superior, banco novo e descartável).
- `src/auth.ts`, `src/ingress.ts`: HMAC sobre os bytes originais, janela de 300 s, resposta 202 só após a fila aceitar.
- `src/persist.ts`, `src/queue.ts`: gravação transacional idempotente, conflito, quarentena e DLQ.
- `src/debts.ts`, `src/questionnaire.ts`: catálogo das 10 dívidas (código textual, quadrante, apelidos) e banco de 30 perguntas.
- `src/entitlements.ts`: habilitação por contrato (Risk Engine e alertas).
- `src/engine/`: IEC (completo e simplificado), IEC global, zonas, DCO, top 3, alertas por persistência e maturidade N0 a N4.

## Testes

```
pnpm --filter @workspace/review test
```

Os testes de banco sobem um PostgreSQL temporário com dados fictícios (precisam dos binários do servidor; sem eles são pulados).
