-- Esquema de referência da ingestão (contrato docs/restart/sed-ingestion/CONTRATO.md).
-- Para um banco novo e descartável, PostgreSQL 15 ou superior. Não é migração de dados.
-- Os papéis (proprietário, ingestão, publicação) são criados fora deste arquivo;
-- veja sql/roles.sql. O proprietário das funções deve ser um papel sem login e sem BYPASSRLS.
CREATE SCHEMA prioris_review;
REVOKE ALL ON SCHEMA prioris_review FROM PUBLIC;

CREATE TABLE prioris_review.clients (client_id text PRIMARY KEY);
CREATE TABLE prioris_review.groups (
  client_id text NOT NULL REFERENCES prioris_review.clients ON DELETE RESTRICT,
  group_id int NOT NULL,
  group_name text NOT NULL,
  PRIMARY KEY (client_id, group_id)
);
-- Catálogo das 10 dívidas. A referência é o código textual, nunca a posição (a numeração varia entre documentos).
CREATE TABLE prioris_review.debts (
  debt_code text PRIMARY KEY CHECK (debt_code ~ '^[a-z_]+$'),
  debt_name text NOT NULL,
  quadrant text NOT NULL CHECK (quadrant IN ('paralisia','retrabalho','cinismo','ruptura'))
);
INSERT INTO prioris_review.debts VALUES
  ('evitacao_conflito','Evitação de Conflito','paralisia'),
  ('decisao_postergada','Decisão Postergada','paralisia'),
  ('comunicacao_ambigua','Comunicação Ambígua','retrabalho'),
  ('autoridade_fragilizada','Autoridade Fragilizada','retrabalho'),
  ('accountability_diluida','Accountability Diluída','retrabalho'),
  ('confianca_erosionada','Confiança Erosionada','cinismo'),
  ('aprendizado_bloqueado','Aprendizado Bloqueado','cinismo'),
  ('alinhamento_simbolico','Alinhamento Simbólico','cinismo'),
  ('energia_emocional_degradada','Energia Emocional Degradada','ruptura'),
  ('maturidade_politica_insuficiente','Maturidade Política Insuficiente','ruptura');

-- Banco de perguntas da pesquisa silenciosa: 3 itens por dívida. O peso (R, I ou I+) ainda não foi definido
-- em nenhum documento e fica nulo. O texto da pergunta vive no código (src/questionnaire.ts).
CREATE TABLE prioris_review.questions (
  question_id text PRIMARY KEY CHECK (question_id ~ '^[a-z_]+\.[1-3]$'),
  debt_code text NOT NULL REFERENCES prioris_review.debts ON DELETE RESTRICT,
  item smallint NOT NULL CHECK (item BETWEEN 1 AND 3),
  weight_class text CHECK (weight_class IN ('R','I','I+')),
  UNIQUE (debt_code, item),
  CHECK (question_id = debt_code || '.' || item)
);
INSERT INTO prioris_review.questions (question_id, debt_code, item)
  SELECT d.debt_code || '.' || i, d.debt_code, i FROM prioris_review.debts d CROSS JOIN generate_series(1, 3) AS i;

-- Habilitação por contrato (definida por administrador). A coleta funciona sempre; consumo pelo Risk Engine
-- e alertas dependem destes sinalizadores. O Risk Engine fica 6 meses habilitado quando o contrato é de 12 meses.
CREATE TABLE prioris_review.client_entitlements (
  client_id text PRIMARY KEY REFERENCES prioris_review.clients ON DELETE RESTRICT,
  contract_months smallint NOT NULL CHECK (contract_months IN (6, 12)),
  cre_enabled boolean NOT NULL DEFAULT false,
  alerts_enabled boolean NOT NULL DEFAULT false,
  CHECK (NOT alerts_enabled OR cre_enabled)
);
CREATE TABLE prioris_review.cycles (
  client_id text NOT NULL REFERENCES prioris_review.clients ON DELETE RESTRICT,
  cycle_start date NOT NULL CHECK (extract(day FROM cycle_start) = 1),
  closed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (client_id, cycle_start)
);

-- SED de evento (MESTRE, seção 7). Sem texto livre.
CREATE TABLE prioris_review.sed_events (
  client_id text NOT NULL,
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 100),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  group_id int NOT NULL,
  contributor_token text NOT NULL CHECK (contributor_token ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL,
  cycle_start date NOT NULL,
  debt_principal text NOT NULL REFERENCES prioris_review.debts ON DELETE RESTRICT,
  debt_adjacent text REFERENCES prioris_review.debts ON DELETE RESTRICT,
  context text NOT NULL CHECK (context IN ('conflito','decisao','alinhamento','feedback','crise')),
  actor text NOT NULL CHECK (actor IN ('time','par','liderado','chefe','cliente')),
  momento text NOT NULL CHECK (momento IN ('Antes','Durante','Depois','Padrao','Vazio')),
  intensity_proxy text NOT NULL CHECK (intensity_proxy IN ('Baixa','Media','Alta')),
  PRIMARY KEY (client_id, event_id),
  FOREIGN KEY (client_id, group_id) REFERENCES prioris_review.groups ON DELETE RESTRICT,
  FOREIGN KEY (client_id, cycle_start) REFERENCES prioris_review.cycles ON DELETE RESTRICT,
  CHECK (debt_adjacent IS NULL OR debt_adjacent <> debt_principal),
  CHECK (cycle_start = date_trunc('month', occurred_at AT TIME ZONE 'UTC')::date)
);
CREATE INDEX ON prioris_review.sed_events (client_id, group_id, cycle_start, debt_principal, momento);

-- Resposta da pesquisa silenciosa (escala 0 a 4). Tabela própria: não é intensidade do evento.
CREATE TABLE prioris_review.survey_answers (
  client_id text NOT NULL,
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 100),
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  group_id int NOT NULL,
  contributor_token text NOT NULL CHECK (contributor_token ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL,
  cycle_start date NOT NULL,
  question_id text NOT NULL REFERENCES prioris_review.questions ON DELETE RESTRICT,
  answer smallint NOT NULL CHECK (answer BETWEEN 0 AND 4),
  PRIMARY KEY (client_id, event_id),
  FOREIGN KEY (client_id, group_id) REFERENCES prioris_review.groups ON DELETE RESTRICT,
  FOREIGN KEY (client_id, cycle_start) REFERENCES prioris_review.cycles ON DELETE RESTRICT,
  CHECK (cycle_start = date_trunc('month', occurred_at AT TIME ZONE 'UTC')::date)
);
CREATE INDEX ON prioris_review.survey_answers (client_id, group_id, cycle_start, question_id);

-- Impede novos dados em ciclo encerrado e sincroniza a inserção com o fechamento (FOR SHARE).
CREATE FUNCTION prioris_review.require_open_cycle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE is_closed boolean;
BEGIN
  SELECT c.closed INTO is_closed FROM prioris_review.cycles c
  WHERE c.client_id = NEW.client_id AND c.cycle_start = NEW.cycle_start FOR SHARE;
  IF is_closed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'cycle unavailable or closed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION prioris_review.require_open_cycle() FROM PUBLIC;
CREATE TRIGGER sed_open_cycle BEFORE INSERT ON prioris_review.sed_events
  FOR EACH ROW EXECUTE FUNCTION prioris_review.require_open_cycle();
CREATE TRIGGER survey_open_cycle BEFORE INSERT ON prioris_review.survey_answers
  FOR EACH ROW EXECUTE FUNCTION prioris_review.require_open_cycle();

-- Fechamento privilegiado: só depois do fim da janela e da drenagem da fila. Não reabre.
CREATE FUNCTION prioris_review.close_cycle(p_client text, p_cycle date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_cycle + interval '1 month' > (now() AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'cycle window not finished' USING ERRCODE = '23514';
  END IF;
  UPDATE prioris_review.cycles SET closed = true
  WHERE client_id = p_client AND cycle_start = p_cycle;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown cycle' USING ERRCODE = '23503';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION prioris_review.close_cycle(text, date) FROM PUBLIC;

ALTER TABLE prioris_review.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE prioris_review.groups FORCE ROW LEVEL SECURITY;
CREATE POLICY groups_tenant ON prioris_review.groups
  USING (client_id = current_setting('app.tenant', true))
  WITH CHECK (client_id = current_setting('app.tenant', true));
ALTER TABLE prioris_review.sed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prioris_review.sed_events FORCE ROW LEVEL SECURITY;
CREATE POLICY events_tenant ON prioris_review.sed_events
  USING (client_id = current_setting('app.tenant', true))
  WITH CHECK (client_id = current_setting('app.tenant', true));
ALTER TABLE prioris_review.survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prioris_review.survey_answers FORCE ROW LEVEL SECURITY;
CREATE POLICY survey_tenant ON prioris_review.survey_answers
  USING (client_id = current_setting('app.tenant', true))
  WITH CHECK (client_id = current_setting('app.tenant', true));

-- Publicação para o motor (servidor). Agregados de ciclo encerrado, com no mínimo
-- 3 participantes distintos na amostra exata. Supressão, não fusão. Isto não é garantia
-- de anonimização. Contagens exatas NÃO devem chegar ao painel.
CREATE FUNCTION prioris_review.sed_release()
RETURNS TABLE (group_id int, cycle_start date, debt_principal text, momento text,
               events bigint, low bigint, medium bigint, high bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT e.group_id, e.cycle_start, e.debt_principal, e.momento,
         count(*),
         count(*) FILTER (WHERE e.intensity_proxy = 'Baixa'),
         count(*) FILTER (WHERE e.intensity_proxy = 'Media'),
         count(*) FILTER (WHERE e.intensity_proxy = 'Alta')
  FROM prioris_review.sed_events e
  JOIN prioris_review.cycles c ON c.client_id = e.client_id AND c.cycle_start = e.cycle_start
  WHERE e.client_id = current_setting('app.tenant', true) AND c.closed
  GROUP BY e.client_id, e.group_id, e.cycle_start, e.debt_principal, e.momento
  HAVING count(DISTINCT e.contributor_token) >= 3
$$;
REVOKE ALL ON FUNCTION prioris_review.sed_release() FROM PUBLIC;

CREATE FUNCTION prioris_review.survey_release()
RETURNS TABLE (group_id int, cycle_start date, question_id text, mean_answer numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  WITH per_person AS (
    SELECT s.client_id, s.group_id, s.cycle_start, s.question_id, s.contributor_token,
           avg(s.answer) AS person_mean
    FROM prioris_review.survey_answers s
    JOIN prioris_review.cycles c ON c.client_id = s.client_id AND c.cycle_start = s.cycle_start
    WHERE s.client_id = current_setting('app.tenant', true) AND c.closed
    GROUP BY s.client_id, s.group_id, s.cycle_start, s.question_id, s.contributor_token
  )
  SELECT p.group_id, p.cycle_start, p.question_id, avg(p.person_mean)
  FROM per_person p
  GROUP BY p.client_id, p.group_id, p.cycle_start, p.question_id
  HAVING count(*) >= 3
$$;
REVOKE ALL ON FUNCTION prioris_review.survey_release() FROM PUBLIC;
