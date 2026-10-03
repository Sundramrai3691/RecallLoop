ALTER TABLE plans ADD COLUMN IF NOT EXISTS available_minutes integer CHECK (available_minutes >= 0);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS planned_minutes integer CHECK (planned_minutes >= 0);
