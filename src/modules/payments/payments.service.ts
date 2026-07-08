import { db } from '../../database/db';
import { ListPaymentsQuery } from './payments.schema';

interface PaymentRow {
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
}

export const getPatientPayments = async (
  patientId: string,
  query: ListPaymentsQuery
): Promise<{ data: PaymentRow[]; meta: object }> => {
  const { status, page, limit } = query;
  const offset = (page - 1) * limit;

  const conditions = ['patient_id = $1'];
  const values: unknown[] = [patientId];
  let idx = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) FROM payments ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  values.push(limit, offset);

  const result = await db.query<PaymentRow>(
    `SELECT * FROM payments
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
