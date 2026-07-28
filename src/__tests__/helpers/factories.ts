/**
 * Test factories.
 *
 * Reusable helpers that perform actual HTTP calls through the running Express
 * app to set up test fixtures. Using real HTTP calls (not direct DB inserts)
 * ensures every factory goes through the same validation and business logic
 * that real users do.
 */
import request from 'supertest';
import app from '../../app';

// ── Patient factory ───────────────────────────────────────────────────────────

export const registerPatient = async (overrides: Record<string, unknown> = {}) => {
  const defaults = {
    email: `patient${Date.now()}@test.com`,
    password: 'Password1',
    first_name: 'Test',
    last_name: 'Patient',
    role: 'patient',
  };
  const res = await request(app)
    .post('/auth/register')
    .send({ ...defaults, ...overrides });
  return res.body.data as { user: Record<string, unknown>; access_token: string; refresh_token: string };
};

// ── Doctor factory ────────────────────────────────────────────────────────────

export const registerDoctor = async (overrides: Record<string, unknown> = {}) => {
  const defaults = {
    email: `doctor${Date.now()}@test.com`,
    password: 'Password1',
    first_name: 'Test',
    last_name: 'Doctor',
    role: 'doctor',
  };
  const res = await request(app)
    .post('/auth/register')
    .send({ ...defaults, ...overrides });
  return res.body.data as { user: Record<string, unknown>; access_token: string; refresh_token: string };
};

// ── Doctor profile factory ────────────────────────────────────────────────────

export const createDoctorProfile = async (token: string, overrides: Record<string, unknown> = {}) => {
  const defaults = {
    specialization: 'General Practice',
    license_number: `LIC-${Date.now()}`,
    consultation_fee: 2500,
    years_of_experience: 5,
  };
  const res = await request(app)
    .post('/doctors/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...defaults, ...overrides });
  return res.body.data as Record<string, unknown> & { id: string };
};

// ── Availability slot factory ─────────────────────────────────────────────────

export const createAvailabilitySlot = async (
  token: string,
  overrides: { day_of_week?: string; start_time?: string; end_time?: string } = {}
) => {
  const defaults = {
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '09:30',
  };
  const res = await request(app)
    .post('/doctors/availability')
    .set('Authorization', `Bearer ${token}`)
    .send({ slots: [{ ...defaults, ...overrides }] });
  return res.body.data[0] as Record<string, unknown> & { id: string };
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the next calendar date matching `dayOfWeek` that is at least
 * 3 days from today — satisfying the 3-day minimum advance-booking rule.
 *
 * @example getBookableDate('monday') → '2025-08-04'
 */
export const getBookableDate = (dayOfWeek: string): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayOfWeek.toLowerCase());
  const date = new Date();
  // Start at least 3 days out
  date.setDate(date.getDate() + 3);
  // Walk forward until we land on the right weekday
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
};
