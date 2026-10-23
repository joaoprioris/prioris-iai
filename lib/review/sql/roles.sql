-- Papéis de referência (executar como administrador, antes de schema.sql).
-- Em produção: senhas e TLS verificável fora deste arquivo; proprietário sem login e sem BYPASSRLS.
CREATE ROLE review_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE review_ingest LOGIN NOBYPASSRLS;   -- worker: SELECT e INSERT apenas
CREATE ROLE review_report LOGIN NOBYPASSRLS;   -- motor: EXECUTE nas funções de publicação apenas
CREATE ROLE review_admin LOGIN NOBYPASSRLS;    -- fechamento de ciclo e cadastros
