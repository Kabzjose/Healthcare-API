import { db, withTransaction } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { DoctorProfileRow, AvailabilitySlotRow, PaginatedResult } from '../../types';
import {
  CreateDoctorProfileInput,
  UpdateDoctorProfileInput,
  CreateAvailabilitySlotsInput,
  ToggleSlotInput,
  ListDoctorsQuery,
} from './doctors.schema';

// ── Shape returned when listing doctors publicly ───────────────────────────────
interface DoctorWithProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  profile_id: string;
  specialization: string;
  bio: string | null;
  consultation_fee: number;
  years_of_experience: number;
}

// ── Create doctor profile ─────────────────────────────────────────────────────
export const createProfile = async (
  userId: string,
  input: CreateDoctorProfileInput
): Promise<DoctorProfileRow> => {
  // Confirm the user exists and has role 'doctor'
  const userResult = await db.query(
    `SELECT id, role FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== 'doctor') throw ApiError.forbidden('Only doctors can create a doctor profile');

  // Check profile does not already exist
  const existing = await db.query(
    `SELECT id FROM doctor_profiles WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows.length > 0) {
    throw ApiError.conflict('Doctor profile already exists');
  }

  // Check license number is unique across all doctors
  const licenseCheck = await db.query(
    `SELECT id FROM doctor_profiles WHERE license_number = $1`,
    [input.license_number]
  );

  if (licenseCheck.rows.length > 0) {
    throw ApiError.conflict('A doctor with this license number already exists');
  }

  const result = await db.query<DoctorProfileRow>(
    `INSERT INTO doctor_profiles
      (user_id, specialization, license_number, bio, consultation_fee, years_of_experience)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      input.specialization,
      input.license_number,
      input.bio ?? null,
      input.consultation_fee,
      input.years_of_experience,
    ]
  );

  logger.info('Doctor profile created', { userId, profileId: result.rows[0].id });

  return result.rows[0];
};

// ── Get doctor profile by userId ──────────────────────────────────────────────
export const getProfileByUserId = async (userId: string): Promise<DoctorWithProfile> => {
  const result = await db.query<DoctorWithProfile>(
    `SELECT
       u.id          AS user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       dp.id         AS profile_id,
       dp.specialization,
       dp.bio,
       dp.consultation_fee,
       dp.years_of_experience
     FROM users u
     JOIN doctor_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1 AND u.is_active = true`,
    [userId]
  );

  if (!result.rows[0]) throw ApiError.notFound('Doctor profile not found');

  return result.rows[0];
};

// ── Get doctor profile by profileId ──────────────────────────────────────────
export const getProfileById = async (profileId: string): Promise<DoctorWithProfile> => {
  const result = await db.query<DoctorWithProfile>(
    `SELECT
       u.id          AS user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       dp.id         AS profile_id,
       dp.specialization,
       dp.bio,
       dp.consultation_fee,
       dp.years_of_experience
     FROM doctor_profiles dp
     JOIN users u ON u.id = dp.user_id
     WHERE dp.id = $1 AND u.is_active = true`,
    [profileId]
  );

  if (!result.rows[0]) throw ApiError.notFound('Doctor not found');

  return result.rows[0];
};

// ── Update doctor profile ─────────────────────────────────────────────────────
export const updateProfile = async (
  userId: string,
  input: UpdateDoctorProfileInput
): Promise<DoctorProfileRow> => {
  // Build SET clause dynamically — only update fields that were sent
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.specialization !== undefined) {
    fields.push(`specialization = $${idx++}`);
    values.push(input.specialization);
  }
  if (input.bio !== undefined) {
    fields.push(`bio = $${idx++}`);
    values.push(input.bio);
  }
  if (input.consultation_fee !== undefined) {
    fields.push(`consultation_fee = $${idx++}`);
    values.push(input.consultation_fee);
  }
  if (input.years_of_experience !== undefined) {
    fields.push(`years_of_experience = $${idx++}`);
    values.push(input.years_of_experience);
  }

  if (fields.length === 0) throw ApiError.badRequest('No fields to update');

  values.push(userId); // last param for WHERE clause

  const result = await db.query<DoctorProfileRow>(
    `UPDATE doctor_profiles
     SET ${fields.join(', ')}
     WHERE user_id = $${idx}
     RETURNING *`,
    values
  );

  if (!result.rows[0]) throw ApiError.notFound('Doctor profile not found');

  logger.info('Doctor profile updated', { userId });

  return result.rows[0];
};

// ── List all active doctors (public — for patients browsing) ──────────────────
export const listDoctors = async (
  query: ListDoctorsQuery
): Promise<PaginatedResult<DoctorWithProfile>> => {
  const { specialization } = query;
  const page = normalizePositiveInt(query.page, 1);
  const limit = normalizePositiveInt(query.limit, 10);
  const offset = (page - 1) * limit;

  // Build optional WHERE filter
  const conditions: string[] = ['u.is_active = true'];
  const values: unknown[] = [];
  let idx = 1;

  if (specialization) {
    // ILIKE = case-insensitive LIKE in PostgreSQL
    conditions.push(`dp.specialization ILIKE $${idx++}`);
    values.push(`%${specialization}%`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count total matching records for pagination meta
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM doctor_profiles dp
     JOIN users u ON u.id = dp.user_id
     ${whereClause}`,
    values
  );

  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch paginated results
  values.push(limit, offset);

  const result = await db.query<DoctorWithProfile>(
    `SELECT
       u.id          AS user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.phone,
       dp.id         AS profile_id,
       dp.specialization,
       dp.bio,
       dp.consultation_fee,
       dp.years_of_experience
     FROM doctor_profiles dp
     JOIN users u ON u.id = dp.user_id
     ${whereClause}
     ORDER BY u.first_name ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const numericValue = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(numericValue) && numericValue >= 1
    ? numericValue
    : fallback;
};

// ── Create availability slots (bulk) ──────────────────────────────────────────
export const createAvailabilitySlots = async (
  userId: string,
  input: CreateAvailabilitySlotsInput
): Promise<AvailabilitySlotRow[]> => {
  // Get the doctor's profile ID from their user ID
  const profileResult = await db.query<{ id: string }>(
    `SELECT id FROM doctor_profiles WHERE user_id = $1`,
    [userId]
  );

  if (!profileResult.rows[0]) {
    throw ApiError.notFound('Doctor profile not found. Create your profile first.');
  }

  const doctorId = profileResult.rows[0].id;

  // Use a transaction — insert all slots or none
  const inserted = await withTransaction(async (client) => {
    const results: AvailabilitySlotRow[] = [];

    for (const slot of input.slots) {
      // ON CONFLICT DO NOTHING — silently skip if exact slot already exists
      // This makes the endpoint idempotent (safe to call multiple times)
      const result = await client.query<AvailabilitySlotRow>(
        `INSERT INTO availability_slots (doctor_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (doctor_id, day_of_week, start_time) DO NOTHING
         RETURNING *`,
        [doctorId, slot.day_of_week, slot.start_time, slot.end_time]
      );

      if (result.rows[0]) results.push(result.rows[0]);
    }

    return results;
  });

  logger.info('Availability slots created', { userId, count: inserted.length });

  return inserted;
};

// ── Get all slots for a doctor (by profileId) ────────────────────────────────
export const getAvailabilitySlots = async (
  profileId: string,
  activeOnly = true
): Promise<AvailabilitySlotRow[]> => {
  const result = await db.query<AvailabilitySlotRow>(
    `SELECT * FROM availability_slots
     WHERE doctor_id = $1
     ${activeOnly ? 'AND is_active = true' : ''}
     ORDER BY
       CASE day_of_week
         WHEN 'monday'    THEN 1
         WHEN 'tuesday'   THEN 2
         WHEN 'wednesday' THEN 3
         WHEN 'thursday'  THEN 4
         WHEN 'friday'    THEN 5
         WHEN 'saturday'  THEN 6
         WHEN 'sunday'    THEN 7
       END,
       start_time ASC`,
    [profileId]
  );

  return result.rows;
};

// ── Toggle a slot active / inactive ──────────────────────────────────────────
export const toggleSlot = async (
  slotId: string,
  userId: string,
  input: ToggleSlotInput
): Promise<AvailabilitySlotRow> => {
  // Confirm slot belongs to this doctor — prevents one doctor editing another's slots
  const result = await db.query<AvailabilitySlotRow>(
    `UPDATE availability_slots
     SET is_active = $1
     WHERE id = $2
       AND doctor_id = (SELECT id FROM doctor_profiles WHERE user_id = $3)
     RETURNING *`,
    [input.is_active, slotId, userId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('Slot not found or does not belong to your profile');
  }

  logger.info('Availability slot toggled', { slotId, is_active: input.is_active });

  return result.rows[0];
};

// ── Delete a slot ─────────────────────────────────────────────────────────────
export const deleteSlot = async (slotId: string, userId: string): Promise<void> => {
  // Check if slot has any upcoming appointments before deleting
  const appointmentCheck = await db.query(
    `SELECT id FROM appointments
     WHERE availability_slot_id = $1
       AND appointment_date >= CURRENT_DATE
       AND status NOT IN ('cancelled')`,
    [slotId]
  );

  if (appointmentCheck.rows.length > 0) {
    throw ApiError.conflict(
      'Cannot delete a slot that has upcoming appointments. Deactivate it instead.'
    );
  }

  const result = await db.query(
    `DELETE FROM availability_slots
     WHERE id = $1
       AND doctor_id = (SELECT id FROM doctor_profiles WHERE user_id = $2)`,
    [slotId, userId]
  );

  if (result.rowCount === 0) {
    throw ApiError.notFound('Slot not found or does not belong to your profile');
  }

  logger.info('Availability slot deleted', { slotId });
};
