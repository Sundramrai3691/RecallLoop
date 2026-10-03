ALTER TABLE assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_mode_check;
ALTER TABLE assessment_sessions ADD CONSTRAINT assessment_sessions_mode_check CHECK (mode IN ('rapid_fire','deep_recall','mastery_check','practice'));
