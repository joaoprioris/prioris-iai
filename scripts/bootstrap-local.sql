\set ON_ERROR_STOP on

SELECT current_database() = 'iai_local' AS expected_local_database \gset
\if :expected_local_database
\else
  \echo 'Recusado: este bootstrap só pode rodar no banco descartável iai_local.'
  \quit
\endif

\if :{?local_email}
\else
  \echo 'Informe -v local_email=um-email-de-teste-autorizado.'
  \quit
\endif

BEGIN;
INSERT INTO organizations (name, plan)
SELECT 'IAí Local Fictício', 'free'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'IAí Local Fictício');

INSERT INTO users (organization_id, email, role)
SELECT id, :'local_email', 'leader'
FROM organizations
WHERE name = 'IAí Local Fictício'
  AND NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower(:'local_email'))
ORDER BY created_at
LIMIT 1;
COMMIT;
