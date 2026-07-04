-- Store Google OAuth tokens per user so we can make API calls on their behalf
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMPTZ;

-- Store the calendar event ID on the appointment so we can delete it on cancellation
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_calendar_event_id VARCHAR(255);