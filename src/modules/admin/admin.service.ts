import { db } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { PaginatedResult, PublicUser } from '../../types';
import {
  AdminListUsersQuery,
  AdminListAppointmentsQuery,
  AdminListPaymentsQuery,
  AdminUpdateUserStatusInput,
  AdminUpdateUserRoleInput,
  AdminUpdateAppointmentStatusInput,
  AdminUpdatePaymentStatusInput,
} from './admin.schemas';

interface AdminUserRow extends PublicUser {
  role: 'patient' | 'doctor' | 'admin';
  is_active: boolean;
  is_verified: boolean;
}

interface AdminAppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: Date;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  consultation_fee: number;
  created_at: Date;
  patient_first_name: string;
  patient_last_name: string;
  doctor_first_name: string;
  doctor_last_name: string;
  specialization: string;
}

interface AdminPaymentRow {
  id: string;
  appointment_id: string;
  patient_id: string;
  provider: string;
  provider_reference: string | null;
  checkout_session_id: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: Date | null;
  created_at: Date;
  patient_first_name: string;
  patient_last_name: string;
  patient_email: string;
  doctor_first_name: string;
  doctor_last_name: string;
  specialization: string;
}

export const getDashboardOverview = async (): Promise<Record<string, unknown>> => {
  const [users, doctors, appointments, payments] = await Promise.all([
    db.query<{ count: string }>('SELECT COUNT(*) FROM users'),
    db.query<{ count: string }>('SELECT COUNT(*) FROM doctor_profiles'),
    db.query<{ count: string }>('SELECT COUNT(*) FROM appointments'),
    db.query<{ count: string }>('SELECT COUNT(*) FROM payments'),
  ]);

  return {
    total_users: Number(users.rows[0].count),
    total_doctors: Number(doctors.rows[0].count),
    total_appointments: Number(appointments.rows[0].count),
    total_payments: Number(payments.rows[0].count),
  };
};

export const listUsers = async (
  query: AdminListUsersQuery
): Promise<PaginatedResult<AdminUserRow>> => {
  const { role, is_active, page, limit } = query;
  const offset = (page - 1) * limit;

  const conditions = ['1 = 1'];
  const values: unknown[] = [];
  let idx = 1;

  if (role) {
    conditions.push(`role = $${idx++}`);
    values.push(role);
  }

  if (is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    values.push(is_active);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);

  const result = await db.query<AdminUserRow>(
    `SELECT id, email, first_name, last_name, phone, role, is_active, is_verified, created_at, updated_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const updateUserStatus = async (
  userId: string,
  input: AdminUpdateUserStatusInput
): Promise<void> => {
  const result = await db.query(
    `UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id`,
    [input.is_active, userId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('User not found');
  }

  logger.info('Admin updated user status', { userId, is_active: input.is_active });
};

export const updateUserRole = async (
  userId: string,
  input: AdminUpdateUserRoleInput
): Promise<void> => {
  const result = await db.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id`,
    [input.role, userId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('User not found');
  }

  logger.info('Admin updated user role', { userId, role: input.role });
};

export const listAppointments = async (
  query: AdminListAppointmentsQuery
): Promise<PaginatedResult<AdminAppointmentRow>> => {
  const { status, payment_status, page, limit } = query;
  const offset = (page - 1) * limit;

  const conditions = ['1 = 1'];
  const values: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`a.status = $${idx++}`);
    values.push(status);
  }

  if (payment_status) {
    conditions.push(`a.payment_status = $${idx++}`);
    values.push(payment_status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)
     FROM appointments a
     JOIN users pu ON pu.id = a.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du ON du.id = dp.user_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);

  const result = await db.query<AdminAppointmentRow>(
    `SELECT
       a.id,
       a.patient_id,
       a.doctor_id,
       a.appointment_date,
       a.start_time,
       a.end_time,
       a.status,
       a.payment_status,
       a.consultation_fee,
       a.created_at,
       pu.first_name AS patient_first_name,
       pu.last_name AS patient_last_name,
       du.first_name AS doctor_first_name,
       du.last_name AS doctor_last_name,
       dp.specialization
     FROM appointments a
     JOIN users pu ON pu.id = a.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du ON du.id = dp.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const updateAppointmentStatus = async (
  appointmentId: string,
  input: AdminUpdateAppointmentStatusInput
): Promise<void> => {
  const result = await db.query(
    `UPDATE appointments SET status = $1 WHERE id = $2 RETURNING id`,
    [input.status, appointmentId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('Appointment not found');
  }

  logger.info('Admin updated appointment status', { appointmentId, status: input.status });
};

export const updatePaymentStatus = async (
  paymentId: string,
  input: AdminUpdatePaymentStatusInput
): Promise<void> => {
  const result = await db.query(
    `UPDATE payments SET status = $1 WHERE id = $2 RETURNING id`,
    [input.status, paymentId]
  );

  if (!result.rows[0]) {
    throw ApiError.notFound('Payment not found');
  }

  logger.info('Admin updated payment status', { paymentId, status: input.status });
};

export const listPayments = async (
  query: AdminListPaymentsQuery
): Promise<PaginatedResult<AdminPaymentRow>> => {
  const { provider, status, page, limit } = query;
  const offset = (page - 1) * limit;

  const conditions = ['1 = 1'];
  const values: unknown[] = [];
  let idx = 1;

  if (provider) {
    conditions.push(`p.provider = $${idx++}`);
    values.push(provider);
  }

  if (status) {
    conditions.push(`p.status = $${idx++}`);
    values.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)
     FROM payments p
     JOIN appointments a ON a.id = p.appointment_id
     JOIN users pu ON pu.id = p.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du ON du.id = dp.user_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);

  const result = await db.query<AdminPaymentRow>(
    `SELECT
       p.id,
       p.appointment_id,
       p.patient_id,
       p.provider,
       p.provider_reference,
       p.checkout_session_id,
       p.amount,
       p.currency,
       p.status,
       p.paid_at,
       p.created_at,
       pu.first_name AS patient_first_name,
       pu.last_name AS patient_last_name,
       pu.email AS patient_email,
       du.first_name AS doctor_first_name,
       du.last_name AS doctor_last_name,
       dp.specialization
     FROM payments p
     JOIN appointments a ON a.id = p.appointment_id
     JOIN users pu ON pu.id = p.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du ON du.id = dp.user_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return {
    data: result.rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};
