ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'FILL_BLANK';

ALTER TABLE questions ADD COLUMN IF NOT EXISTS expected_answer text;

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS leaderboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_score_immediately boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_correct_answers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS randomize_options boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS one_attempt_per_roll boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS integrity_monitoring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_submit boolean NOT NULL DEFAULT true;

ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS roll_number text,
  ADD COLUMN IF NOT EXISTS tab_switch_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS quizzes_join_code_idx ON quizzes(join_code);
CREATE INDEX IF NOT EXISTS quiz_attempts_roll_idx ON quiz_attempts(quiz_id, roll_number);

CREATE TABLE IF NOT EXISTS exam_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('TAB_HIDDEN','WINDOW_BLUR','WINDOW_FOCUS','AUTO_SUBMIT')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS exam_events_attempt_idx ON exam_events(attempt_id, occurred_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id, expires_at, used_at);