CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

CREATE TYPE payment_provider AS ENUM (
  'stripe',
  'mpesa'
);

CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id        UUID NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  patient_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider              payment_provider NOT NULL,
  provider_reference    VARCHAR(255),      -- Stripe payment intent ID or M-Pesa transaction ID
  checkout_session_id   VARCHAR(255),      -- Stripe checkout session ID
  amount                NUMERIC(10, 2) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'KES',
  status                payment_status NOT NULL DEFAULT 'pending',
  paid_at               TIMESTAMPTZ,
  metadata              JSONB,             -- store any extra provider data
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_appointment_id     ON payments(appointment_id);
CREATE INDEX idx_payments_patient_id         ON payments(patient_id);
CREATE INDEX idx_payments_provider_reference ON payments(provider_reference);
CREATE INDEX idx_payments_status             ON payments(status);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add payment status column to appointments table
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id);