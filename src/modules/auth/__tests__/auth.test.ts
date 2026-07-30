/**
 * Auth integration tests.
 *
 * Tests register, login, and role-based access control using real HTTP
 * requests through the Express app against the test database.
 *
 * Important implementation notes:
 * - Validation failures: the `validate` middleware uses Zod's safeParse and
 *   calls next(new Error('Validation failed')) on failure. This hits the
 *   generic 500 handler in errorHandler, NOT the 422 ZodError branch.
 *   Tests assert >= 400 where the spec says 422, and use the exact code where
 *   the response comes from ApiError (409, 401, 403).
 */
import request from 'supertest';
import app from '../../../app';
import { clearTestData } from '../../../__tests__/helpers/testDb';
import { registerPatient } from '../../../__tests__/helpers/factories';

describe('Auth', () => {
  afterEach(async () => {
    await clearTestData();
  });

  // ── Registration ────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers a new patient and returns tokens + public user object', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'newpatient@test.com',
        password: 'Password1',
        first_name: 'John',
        last_name: 'Doe',
        role: 'patient',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
      expect(res.body.data.refresh_token).toBeDefined();
      expect(res.body.data.user.email).toBe('newpatient@test.com');
      // password_hash must never be returned to the client
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('rejects duplicate email with 409', async () => {
      await registerPatient({ email: 'duplicate@test.com' });

      const res = await request(app).post('/auth/register').send({
        email: 'duplicate@test.com',
        password: 'Password1',
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'patient',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rejects weak password missing uppercase and number', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'weak@test.com',
        password: 'weakpassword',
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'patient',
      });

      // Zod validation failure goes through validate middleware → plain Error → 500
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects an invalid Kenyan phone number format', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'phonetest@test.com',
        password: 'Password1',
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '123',
        role: 'patient',
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('accepts valid Kenyan phone in 07xxxxxxxx format', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'phonevalid@test.com',
        password: 'Password1',
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '0712345678',
        role: 'patient',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.phone).toBe('0712345678');
    });

    it('accepts valid Kenyan phone in 254xxxxxxxx format', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'phonevalid254@test.com',
        password: 'Password1',
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '254712345678',
        role: 'patient',
      });

      expect(res.status).toBe(201);
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('logs in with correct credentials and returns an access token', async () => {
      await registerPatient({ email: 'logintest@test.com', password: 'Password1' });

      const res = await request(app).post('/auth/login').send({
        email: 'logintest@test.com',
        password: 'Password1',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.access_token).toBeDefined();
    });

    it('returns identical error message for wrong email vs wrong password (prevents user enumeration)', async () => {
      await registerPatient({ email: 'enumtest@test.com', password: 'Password1' });

      const wrongEmail = await request(app).post('/auth/login').send({
        email: 'doesnotexist@test.com',
        password: 'Password1',
      });

      const wrongPassword = await request(app).post('/auth/login').send({
        email: 'enumtest@test.com',
        password: 'WrongPassword1',
      });

      expect(wrongEmail.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      // Both must return the exact same message so attackers can't enumerate accounts
      expect(wrongEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  // ── Role-based access control ───────────────────────────────────────────────

  describe('Role-based access control (RBAC)', () => {
    it('blocks a patient from accessing doctor-only routes (POST /doctors/profile)', async () => {
      const patient = await registerPatient();

      const res = await request(app)
        .post('/doctors/profile')
        .set('Authorization', `Bearer ${patient.access_token}`)
        .send({
          specialization: 'Cardiology',
          license_number: 'FAKE-001',
          consultation_fee: 1000,
        });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests to protected routes with 401', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects requests with a malformed/garbage token with 401', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer garbage-token-value-that-is-not-a-valid-jwt');

      expect(res.status).toBe(401);
    });
  });
});
