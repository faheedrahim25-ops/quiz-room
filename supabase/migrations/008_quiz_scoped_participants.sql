CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_roll_idx
  ON quiz_attempts(quiz_id, roll_number)
  WHERE roll_number IS NOT NULL;