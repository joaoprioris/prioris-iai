-- Development migration. Execute only against a verified isolated test database.
-- No update of existing sessions/users or automatic activation of personal history.
CREATE UNIQUE INDEX IF NOT EXISTS prioris_user_identity_scope ON users(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS prioris_session_identity_scope ON sessions(id, user_id, organization_id);
CREATE TABLE IF NOT EXISTS prioris_history_preferences (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  notice_version text,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id),
  FOREIGN KEY (user_id, organization_id) REFERENCES users(id, organization_id) ON DELETE CASCADE,
  CHECK (NOT enabled OR (notice_version IS NOT NULL AND notice_version = 'history-v1-20261012'))
);
CREATE TABLE IF NOT EXISTS prioris_private_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, organization_id) REFERENCES users(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id, user_id, organization_id) REFERENCES sessions(id,user_id,organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prioris_private_history_owner_time ON prioris_private_history(organization_id,user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS prioris_completed_requests (
 user_id uuid NOT NULL,
 organization_id uuid NOT NULL,
 session_id uuid NOT NULL,
 request_id text NOT NULL CHECK (request_id ~ '^[a-zA-Z0-9-]{8,100}$'),
 content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY (session_id,user_id,organization_id,request_id),
 FOREIGN KEY (session_id,user_id,organization_id) REFERENCES sessions(id,user_id,organization_id) ON DELETE CASCADE
);
-- Application queries must still use authenticated owner + organization scope.
-- This is not a claim of database-owner invisibility or complete legal compliance.
