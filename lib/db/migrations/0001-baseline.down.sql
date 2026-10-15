-- DESTRUCTIVE: exclusively for an EMPTY DISPOSABLE baseline rehearsal.
-- Existing/valuable databases: restore a verified backup to a separate target,
-- reconcile subsequent writes, and obtain explicit authorization before cutover.
BEGIN;
DROP TABLE survey_tracking, survey_responses, seds, sessions, users, moment_library, questions, organizations;
COMMIT;
