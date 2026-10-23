-- Permissões mínimas (executar depois de schema.sql, como administrador).
GRANT USAGE ON SCHEMA prioris_review TO review_ingest, review_report, review_admin;
GRANT SELECT, INSERT ON prioris_review.sed_events, prioris_review.survey_answers TO review_ingest;
GRANT EXECUTE ON FUNCTION prioris_review.sed_release(), prioris_review.survey_release(), prioris_review.adjacency_release(), prioris_review.group_cycle_release() TO review_report;
GRANT EXECUTE ON FUNCTION prioris_review.close_cycle(text, date) TO review_admin;
GRANT SELECT, INSERT ON prioris_review.clients, prioris_review.groups, prioris_review.cycles TO review_admin;
GRANT SELECT ON prioris_review.debts, prioris_review.questions TO review_ingest, review_report, review_admin;
GRANT SELECT, INSERT, UPDATE ON prioris_review.client_entitlements TO review_admin;
