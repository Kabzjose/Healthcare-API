CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id   UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  start_time  TIME NOT NULL,  -- e.g. 09:00
  end_time    TIME NOT NULL,  -- e.g. 09:30
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate slots: same doctor, same day, same start time
  CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, day_of_week, start_time),
  -- Ensure end time is always after start time
  CONSTRAINT chk_slot_times CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_doctor_id   ON availability_slots(doctor_id);
CREATE INDEX idx_availability_day_of_week ON availability_slots(day_of_week);