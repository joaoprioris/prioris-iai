-- Baseline of the existing Drizzle schema; empty/disposable databases ONLY.
-- This does not enable SED, surveys, or any application feature.
BEGIN;
CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, plan text DEFAULT 'free', created_at timestamp DEFAULT now());
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, email text NOT NULL, role text DEFAULT 'leader', auth_token text, created_at timestamp DEFAULT now(), CONSTRAINT users_email_unique UNIQUE(email));
CREATE TABLE sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, organization_id uuid NOT NULL, agent_type text NOT NULL, context jsonb DEFAULT '{}'::jsonb, exchange_count integer DEFAULT 0, status text DEFAULT 'active', incident boolean DEFAULT false, incident_reason text, created_at timestamp DEFAULT now());
CREATE TABLE seds (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, session_id uuid NOT NULL, organization_id uuid NOT NULL, debt_primary text NOT NULL, debt_adjacent text, context_type text NOT NULL, actor text, moment_code text, moment_phase text, intensity integer, confidence double precision, agent_self_assessment text, low_confidence boolean DEFAULT false, timestamp timestamp with time zone DEFAULT now(), created_at timestamp DEFAULT now(), CONSTRAINT seds_intensity_check CHECK (intensity BETWEEN 1 AND 5));
CREATE TABLE survey_responses (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, question_id uuid NOT NULL, session_id uuid, answer_value integer NOT NULL, created_at timestamp DEFAULT now(), CONSTRAINT survey_responses_answer_value_check CHECK (answer_value BETWEEN 0 AND 4));
CREATE TABLE survey_tracking (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, question_id uuid NOT NULL, shown_at timestamp with time zone DEFAULT now());
CREATE TABLE questions (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, debt_id text NOT NULL, text text NOT NULL, weight_type text NOT NULL, active boolean DEFAULT true, CONSTRAINT questions_weight_type_check CHECK (weight_type IN ('I_PLUS','I','R')));
CREATE TABLE moment_library (id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, moment_code text NOT NULL, agent text NOT NULL, moment_name text NOT NULL, description text, debt_primary text NOT NULL, debt_adjacent text, context_type text NOT NULL, trigger_phase text, example_input text, response_notes text, status text DEFAULT 'draft', CONSTRAINT moment_library_moment_code_unique UNIQUE(moment_code));
ALTER TABLE users ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE sessions ADD CONSTRAINT sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE seds ADD CONSTRAINT seds_session_id_sessions_id_fk FOREIGN KEY (session_id) REFERENCES public.sessions(id);
ALTER TABLE seds ADD CONSTRAINT seds_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_session_id_sessions_id_fk FOREIGN KEY (session_id) REFERENCES public.sessions(id);
ALTER TABLE survey_tracking ADD CONSTRAINT survey_tracking_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE survey_tracking ADD CONSTRAINT survey_tracking_question_id_questions_id_fk FOREIGN KEY (question_id) REFERENCES public.questions(id);
COMMIT;
