CREATE TYPE appointment_status AS ENUM (
  'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
);

CREATE TABLE IF NOT EXISTS appointments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  doctor_id             UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE RESTRICT,
  availability_slot_id  UUID NOT NULL REFERENCES availability_slots(id) ON DELETE RESTRICT,
  appointment_date      DATE NOT NULL,
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  status                appointment_status NOT NULL DEFAULT 'pending',
  reason                TEXT,             -- why the patient is visiting
  notes                 TEXT,             -- doctor's notes (post-appointment)
  consultation_fee      NUMERIC(10, 2) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Core business rule: one patient can't book the same slot on the same date twice
  CONSTRAINT uq_appointment UNIQUE (doctor_id, availability_slot_id, appointment_date),

  -- Can't book appointments in the past
  CONSTRAINT chk_appointment_date CHECK (appointment_date >= CURRENT_DATE)
);

CREATE INDEX idx_appointments_patient_id       ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id        ON appointments(doctor_id);
CREATE INDEX idx_appointments_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status           ON appointments(status);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();