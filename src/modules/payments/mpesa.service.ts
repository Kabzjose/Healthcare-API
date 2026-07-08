import { db } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import * as smsService from '../../integrations/africas-talking/sms.service';
import * as mpesaService from '../../integrations/mpesa/mpesa.service';
import { InitiateMpesaInput } from './payments.schema';

export const initiateMpesaPayment = async (
  patientId: string,
  input: InitiateMpesaInput
): Promise<{ checkoutRequestId: string; message: string }> => {
  const apptResult = await db.query<{
    id: string;
    patient_id: string;
    status: string;
    payment_status: string;
    consultation_fee: number;
    appointment_date: string;
  }>(
    `SELECT id, patient_id, status, payment_status, consultation_fee, appointment_date
     FROM appointments WHERE id = $1`,
    [input.appointment_id]
  );

  const appt = apptResult.rows[0];
  if (!appt) throw ApiError.notFound('Appointment not found');
  if (appt.patient_id !== patientId) throw ApiError.forbidden('Not your appointment');
  if (appt.status === 'cancelled') throw ApiError.badRequest('Cannot pay for a cancelled appointment');
  if (appt.payment_status === 'succeeded') throw ApiError.conflict('Appointment is already paid');

  const { checkoutRequestId, merchantRequestId } = await mpesaService.initiateSTKPush({
    phone: input.phone,
    amount: appt.consultation_fee,
    appointmentId: appt.id,
    accountReference: `APPT-${appt.id.slice(0, 8).toUpperCase()}`,
    description: 'Consultation fee',
  });

  await db.query(
    `INSERT INTO payments
       (appointment_id, patient_id, provider, provider_reference, amount, currency, status, metadata)
     VALUES ($1, $2, 'mpesa', $3, $4, 'KES', 'pending', $5)`,
    [appt.id, patientId, checkoutRequestId, appt.consultation_fee, JSON.stringify({ merchantRequestId })]
  );

  logger.info('M-Pesa payment initiated', {
    appointmentId: appt.id,
    checkoutRequestId,
  });

  return {
    checkoutRequestId,
    message: 'STK push sent to your phone. Enter your M-Pesa PIN to complete payment.',
  };
};

export const handleMpesaCallback = async (
  payload: mpesaService.MpesaCallbackPayload
): Promise<void> => {
  const parsed = mpesaService.parseCallbackMetadata(payload);
  const checkoutRequestId = payload.Body.stkCallback.CheckoutRequestID;

  logger.info('M-Pesa callback received', {
    checkoutRequestId,
    success: parsed.success,
    resultCode: parsed.resultCode,
  });

  if (parsed.success) {
    const paymentResult = await db.query<{ appointment_id: string; patient_id: string }>(
      `UPDATE payments
       SET status = 'succeeded',
           paid_at = NOW(),
           metadata = metadata || $1
       WHERE provider_reference = $2
       RETURNING appointment_id, patient_id`,
      [
        JSON.stringify({
          mpesaReceiptNumber: parsed.mpesaReceiptNumber,
          transactionDate: parsed.transactionDate,
        }),
        checkoutRequestId,
      ]
    );

    const payment = paymentResult.rows[0];

    if (payment) {
      await db.query(`UPDATE appointments SET payment_status = 'succeeded' WHERE id = $1`, [payment.appointment_id]);

      const patientResult = await db.query<{
        phone: string | null;
        first_name: string;
        last_name: string;
        consultation_fee: number;
        appointment_date: string;
        doctor_first_name: string;
        doctor_last_name: string;
      }>(
        `SELECT
           pu.phone, pu.first_name, pu.last_name,
           a.consultation_fee, a.appointment_date,
           du.first_name AS doctor_first_name,
           du.last_name  AS doctor_last_name
         FROM appointments a
         JOIN users pu           ON pu.id = a.patient_id
         JOIN doctor_profiles dp ON dp.id = a.doctor_id
         JOIN users du           ON du.id = dp.user_id
         WHERE a.id = $1`,
        [payment.appointment_id]
      );

      const patient = patientResult.rows[0];

      if (patient?.phone) {
        await smsService.sendPaymentConfirmation({
          phone: patient.phone,
          patientName: `${patient.first_name} ${patient.last_name}`,
          amount: patient.consultation_fee,
          reference: parsed.mpesaReceiptNumber ?? checkoutRequestId,
          doctorName: `${patient.doctor_first_name} ${patient.doctor_last_name}`,
          date: patient.appointment_date,
        });
      }
    }
  } else {
    await db.query(`UPDATE payments SET status = 'failed' WHERE provider_reference = $1`, [checkoutRequestId]);

    logger.info('M-Pesa payment failed', {
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
    });
  }
};
