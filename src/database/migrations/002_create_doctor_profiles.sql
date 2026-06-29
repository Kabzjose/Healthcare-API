CREATE TABLE IF NOT EXISTS doctor_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization        VARCHAR(100) NOT NULL,
  license_number        VARCHAR(100) NOT NULL UNIQUE,
  bio                   TEXT,
  consultation_fee      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  years_of_experience   INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_profiles_user_id       ON doctor_profiles(user_id);
CREATE INDEX idx_doctor_profiles_specialization ON doctor_profiles(specialization);

CREATE TRIGGER doctor_profiles_updated_at
  BEFORE UPDATE ON doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();