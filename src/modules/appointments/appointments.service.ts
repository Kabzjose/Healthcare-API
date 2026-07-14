import { db, withTransaction } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import * as smsService from '../../integrations/africas-talking/sms.service';
import { PaginatedResult ,AppointmentRow, AppointmentWithDetails } from '../../types';
import {
  BookAppointmentInput,
  UpdateAppointmentStatusInput,
  ListAppointmentsQuery,
} from './appointments.schema';


// ── Create Appointment (Patient) ─────────────────────────────────────────────
export const createAppointment = async (
  patientId: string,
  input: BookAppointmentInput
): Promise<AppointmentRow> => {
  // 1. Enforce 3-day minimum lead time
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  minDate.setHours(0, 0, 0, 0);

  const apptDate = new Date(input.appointment_date + 'T00:00:00');
  if (apptDate < minDate) {
    throw ApiError.badRequest('Appointments must be booked at least 3 days in advance.');
  }

  const appointmentDay = new Date(`${input.appointment_date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).toLowerCase();

  // 2. Fetch slot details first, then validate the exact failure reason
  const slotResult = await db.query<any>(
    `SELECT s.*, dp.consultation_fee
     FROM availability_slots s
     JOIN doctor_profiles dp ON dp.id = s.doctor_id
     WHERE s.id = $1`,
    [input.availability_slot_id]
  );

  if (!slotResult.rows[0]) {
    throw ApiError.notFound('Slot not found, inactive, or does not match the selected date.');
  }

  const slot = slotResult.rows[0];

  if (slot.doctor_id !== input.doctor_id) {
    throw ApiError.badRequest('The selected slot does not belong to the chosen doctor.');
  }

  if (!slot.is_active) {
    throw ApiError.notFound('The selected slot is inactive.');
  }

  if (appointmentDay !== slot.day_of_week) {
    throw ApiError.badRequest('The selected appointment date does not match this slot day.');
  }

  // 3. Use a transaction to prevent double-booking
  const appointment = await withTransaction(async (client) => {
    // Check if patient already has an overlapping appointment on this date
    const overlapCheck = await client.query(
      `SELECT a.id 
       FROM appointments a
       JOIN availability_slots s ON a.availability_slot_id = s.id
       WHERE a.patient_id = $1
         AND a.appointment_date = $2
         AND a.status NOT IN ('cancelled', 'no_show')
         AND (s.start_time, s.end_time) OVERLAPS ($3::time, $4::time)`,
      [patientId, input.appointment_date, slot.start_time, slot.end_time]
    );

    if (overlapCheck.rows.length > 0) {
      throw ApiError.conflict('You already have an appointment scheduled at this time.');
    }

    // Insert the appointment
    // Note: The DB unique constraint (doctor_id, availability_slot_id, appointment_date) 
    // will automatically prevent the doctor from being double-booked for this exact slot.
   try {
  const result = await client.query<AppointmentRow>(
    `INSERT INTO appointments (
       patient_id, doctor_id, availability_slot_id, appointment_date, 
       start_time, end_time, reason, consultation_fee
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      patientId,
      input.doctor_id,
      input.availability_slot_id,
      input.appointment_date,
      slot.start_time,
      slot.end_time,
      input.reason ?? null,
      slot.consultation_fee,
    ]
  );

  const appointment = result.rows[0];

  // Log successfully BEFORE returning the value
  logger.info('Appointment created', { 
    appointmentId: appointment.id, 
    patientId 
  });

  
  // Fetch full joined appointment details for SMS
const fullAppointment = await getAppointmentById(appointment.id, patientId, 'patient');

Promise.all([
  db.query<{ phone: string | null; first_name: string; last_name: string }>(
    `SELECT u.phone, u.first_name, u.last_name
     FROM users u WHERE u.id = $1`,
    [patientId]
  ).then(({ rows }) => {
    if (rows[0]?.phone) {
      return smsService.sendBookingConfirmationToPatient({
        phone: rows[0].phone,
        patientName: fullAppointment.patient_name,
        doctorName: fullAppointment.doctor_name,
        date: input.appointment_date,
        startTime: fullAppointment.start_time,
        fee: fullAppointment.consultation_fee,
      });
    }
    return Promise.resolve();
  }).catch((err) => {
    logger.error('Failed to send patient booking SMS', { error: err?.message });
  }),

  db.query<{ phone: string | null; first_name: string; last_name: string }>(
    `SELECT u.phone, u.first_name, u.last_name
     FROM users u
     JOIN doctor_profiles dp ON dp.user_id = u.id
     WHERE dp.id = $1`,
    [input.doctor_id]
  ).then(({ rows }) => {
    if (rows[0]?.phone) {
      return smsService.sendBookingNotificationToDoctor({
        phone: rows[0].phone,
        doctorName: fullAppointment.doctor_name,
        patientName: fullAppointment.patient_name,
        date: input.appointment_date,
        startTime: fullAppointment.start_time,
        reason: input.reason,
      });
    }
    return Promise.resolve();
  }).catch((err) => {
    logger.error('Failed to send doctor booking SMS', { error: err?.message });
  }),
]).catch((err) => {
  logger.error('Post-booking notification failed', { error: err?.message });
});

return fullAppointment;
} catch (err: any) {
   if (
    err.code === '23505' &&
    err.constraint === 'appointments_doctor_id_availability_slot_id_appointment_date_key'
  ) {
    throw ApiError.conflict(
      'This slot has already been booked by another patient.'
    );
  }
  throw err;
}

  });

  return appointment;
};

  

// ── Cancel Appointment (Patient) ─────────────────────────────────────────────
export const cancelAppointment = async (
  appointmentId: string,
  patientId: string
): Promise<AppointmentRow> => {
  // Enforce 24-hour cancellation cutoff
  const cutoffCheck = await db.query(
    `SELECT id FROM appointments
     WHERE id = $1 AND patient_id = $2
       AND (appointment_date + start_time) <= NOW() + INTERVAL '24 hours'`,
    [appointmentId, patientId]
  );

  if (cutoffCheck.rows.length > 0) {
    throw ApiError.badRequest('Cannot cancel within 24 hours of the appointment start time.');
  }

  const result = await db.query<AppointmentRow>(
    `UPDATE appointments
     SET status = 'cancelled'
     WHERE id = $1 AND patient_id = $2 AND status IN ('pending', 'confirmed')
     RETURNING *`,
    [appointmentId, patientId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('Appointment not found or already completed/cancelled.');
  }

  logger.info('Appointment cancelled', { appointmentId });
  return result.rows[0];
};

// ── Update Status (Doctor) ───────────────────────────────────────────────────
export const updateAppointmentStatus = async (
  appointmentId: string,
  doctorId: string,
  input: UpdateAppointmentStatusInput
): Promise<AppointmentRow> => {

  // 1. Resolve doctor_profiles.id from the doctor's user id
  const profileResult = await db.query<{ id: string }>(
  `SELECT id FROM doctor_profiles WHERE user_id = $1`,
  [doctorId]
);

if (!profileResult.rows[0]) {
  throw ApiError.notFound('Doctor profile not found.');
}

  // 1. Verify ownership and get current status
  const current = await db.query<{ status: string }>(
    `SELECT status FROM appointments WHERE id = $1 AND doctor_id = $2`,
    [appointmentId, doctorId]
  );

  if (!current.rows[0]) throw ApiError.notFound('Appointment not found');
  const currentStatus = current.rows[0].status;

  // 2. Enforce State Machine transitions
  const allowedTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'no_show', 'cancelled'],
  };

  if (!allowedTransitions[currentStatus]?.includes(input.status)) {
    throw ApiError.badRequest(
      `Cannot transition appointment from '${currentStatus}' to '${input.status}'`
    );
  }

  // 3. Update status
  const result = await db.query<AppointmentRow>(
    `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *`,
    [input.status, appointmentId]
  );

  logger.info('Appointment status updated', { appointmentId, newStatus: input.status });
  return result.rows[0];
};

// ── List Appointments (Patient/Doctor) ───────────────────────────────────────
export const listAppointments = async (
  userId: string,
  role: string,
  query: ListAppointmentsQuery
): Promise<PaginatedResult<AppointmentWithDetails>> => {
  const { page, limit, status } = query;
  const view = (query as ListAppointmentsQuery & { view?: 'upcoming' | 'past' }).view;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 10;
  const offset = (safePage - 1) * safeLimit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  // Filter by role (Patient sees their own, Doctor sees their own)
  if (role === 'patient') {
    conditions.push(`a.patient_id = $${idx++}`);
    values.push(userId);
  } else if (role === 'doctor') {
    conditions.push(`a.doctor_id = $${idx++}`);
    values.push(userId);
  }

  // Filter by status
  if (status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(status);
  }

  // Filter by Upcoming vs Past
  if (view === 'upcoming') {
    conditions.push(
      `(a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.end_time > CURRENT_TIME))`
    );
  } else if (view === 'past') {
    conditions.push(
      `(a.appointment_date < CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.end_time <= CURRENT_TIME))`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total for pagination
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM appointments a ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch paginated data
  values.push(safeLimit, offset);
  const result = await db.query<AppointmentWithDetails>(
    `SELECT
       a.id, a.appointment_date, a.start_time, a.end_time, a.status, 
       a.reason, a.notes, a.consultation_fee, a.created_at,
       -- Patient details
       p.first_name || ' ' || p.last_name AS patient_name,
       p.email AS patient_email,
       -- Doctor details
       dp.id AS doctor_id,
       d.first_name || ' ' || d.last_name AS doctor_name,
       dp.specialization
     FROM appointments a
     JOIN users p ON p.id = a.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users d ON d.id = dp.user_id
     ${whereClause}
     ORDER BY a.appointment_date ASC, a.start_time ASC
      LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
  };
};

// ── List Appointments for Doctor (by doctor's user id) ──────────────────────
export const getDoctorAppointments = async (
  doctorUserId: string,
  query: ListAppointmentsQuery & { date?: string }
): Promise<PaginatedResult<AppointmentWithDetails>> => {
  const { page, limit, status, date } = query;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 10;
  const offset = (safePage - 1) * safeLimit;

  // 1. Resolve doctor_profiles.id from the doctor's user id
  const profileResult = await db.query<{ id: string }>(
    `SELECT id FROM doctor_profiles WHERE user_id = $1`,
    [doctorUserId]
  );

  if (!profileResult.rows[0]) {
    throw ApiError.notFound('Doctor profile not found.');
  }

  const doctorProfileId = profileResult.rows[0].id;

  // Add temporarily
  logger.info('Doctor appointments query', {
    doctorUserId,
    doctorProfileId,
    filters: { status, date, page, limit },
  });

  // 2. Build dynamic WHERE clause
  const conditions: string[] = [`a.doctor_id = $1`];
  const values: unknown[] = [doctorProfileId];
  let idx = 2;

  if (status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(status);
  }

  if (date) {
    conditions.push(`a.appointment_date = $${idx++}`);
    values.push(date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // 3. Count total for pagination
  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM appointments a ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // 4. Fetch paginated data
  values.push(safeLimit, offset);
  const result = await db.query<AppointmentWithDetails>(
    `SELECT
       a.id, a.appointment_date, a.start_time, a.end_time, a.status,
       a.reason, a.notes, a.consultation_fee, a.created_at,
       p.first_name || ' ' || p.last_name AS patient_name,
       p.email AS patient_email,
       dp.id AS doctor_id,
       d.first_name || ' ' || d.last_name AS doctor_name,
       dp.specialization
     FROM appointments a
     JOIN users p ON p.id = a.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users d ON d.id = dp.user_id
     ${whereClause}
     ORDER BY a.appointment_date ASC, a.start_time ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
  };
};

// ── Get Single Appointment ───────────────────────────────────────────────────
export const getAppointmentById = async (
  appointmentId: string,
  userId: string,
  role: string
): Promise<AppointmentWithDetails> => {
  const roleCondition = role === 'patient' ? 'a.patient_id = $2' : 'a.doctor_id = $2';

  const result = await db.query<AppointmentWithDetails>(
    `SELECT
   a.id,
   a.appointment_date,
   a.start_time,
   a.end_time,
   a.status,
   a.reason,
   a.notes,
   a.consultation_fee,
   a.created_at,
   a.patient_id,
   pu.first_name   AS patient_name,
   pu.last_name    AS patient_name,
   pu.email        AS patient_email,
   pu.phone        AS patient_phone,
   dp.id           AS doctor_id,
   du.first_name   AS doctor_first_name,   
   du.last_name    AS doctor_last_name,    
   du.email        AS doctor_email,
   dp.specialization
 FROM appointments a
 JOIN users pu          ON pu.id = a.patient_id
 JOIN doctor_profiles dp ON dp.id = a.doctor_id
 JOIN users du          ON du.id = dp.user_id   
 WHERE a.id = $1 AND ${roleCondition}`,
    [appointmentId, userId]
  );

// Add this temporarily
console.log('First appointment row:', JSON.stringify(result.rows[0], null, 2));

  if (!result.rows[0]) throw ApiError.notFound('Appointment not found');
  return result.rows[0];
};