import Stripe from 'stripe';
import { stripe } from '../../integrations/stripe/stripe.client';
import { db } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import * as smsService from '../../integrations/africas-talking/sms.service';
import { CreateCheckoutSessionInput, ListPaymentsQuery } from './payments.schema';
import * as mpesaService from '../../integrations/mpesa/mpesa.service';
import { InitiateMpesaInput } from './payments.schema';

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

// ── Create a Stripe checkout session ─────────────────────────────────────────
export const createCheckoutSession = async (
  patientId: string,
  input: CreateCheckoutSessionInput
): Promise<{ checkout_url: string; payment_id: string }> => {

  // Fetch the appointment and confirm it belongs to this patient
  const apptResult = await db.query<{
    id: string;
    patient_id: string;
    status: string;
    payment_status: string;
    consultation_fee: number;
    appointment_date: string;
    doctor_first_name: string;
    doctor_last_name: string;
    specialization: string;
    patient_email: string;
    patient_first_name: string;
    patient_last_name: string;
  }>(
    `SELECT
       a.id,
       a.patient_id,
       a.status,
       a.payment_status,
       a.consultation_fee,
       a.appointment_date,
       du.first_name   AS doctor_first_name,
       du.last_name    AS doctor_last_name,
       dp.specialization,
       pu.email        AS patient_email,
       pu.first_name   AS patient_first_name,
       pu.last_name    AS patient_last_name
     FROM appointments a
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du           ON du.id = dp.user_id
     JOIN users pu           ON pu.id = a.patient_id
     WHERE a.id = $1`,
    [input.appointment_id]
  );

  const appt = apptResult.rows[0];
  if (!appt) throw ApiError.notFound('Appointment not found');
  if (appt.patient_id !== patientId) throw ApiError.forbidden('Not your appointment');
  if (appt.status === 'cancelled') throw ApiError.badRequest('Cannot pay for a cancelled appointment');
  if (appt.payment_status === 'succeeded') throw ApiError.conflict('Appointment is already paid');

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: appt.patient_email,
    line_items: [
      {
        price_data: {
          currency: env.STRIPE_CURRENCY ?? 'kes',
          product_data: {
            name: `Consultation with Dr. ${appt.doctor_first_name} ${appt.doctor_last_name}`,
            description: `${appt.specialization} — ${appt.appointment_date}`,
          },
          // Stripe amounts are in the smallest currency unit (cents / fils)
          // KES has no subunit so multiply by 100 for Stripe's format
          unit_amount: Math.round(appt.consultation_fee * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.STRIPE_CANCEL_URL,
    metadata: {
      appointment_id: appt.id,
      patient_id: patientId,
    },
  });

  // Record the pending payment in our database
  const paymentResult = await db.query<PaymentRow>(
    `INSERT INTO payments
       (appointment_id, patient_id, provider, checkout_session_id, amount, currency, status)
     VALUES ($1, $2, 'stripe', $3, $4, $5, 'pending')
     RETURNING *`,
    [
      appt.id,
      patientId,
      session.id,
      appt.consultation_fee,
      (env.STRIPE_CURRENCY ?? 'kes').toUpperCase(),
    ]
  );

  // Link payment record to the appointment
  await db.query(
    `UPDATE appointments SET payment_id = $1 WHERE id = $2`,
    [paymentResult.rows[0].id, appt.id]
  );

  logger.info('Stripe checkout session created', {
    sessionId: session.id,
    appointmentId: appt.id,
    amount: appt.consultation_fee,
  });

  return {
    checkout_url: session.url as string,
    payment_id: paymentResult.rows[0].id,
  };
};

// ── Handle Stripe webhook ─────────────────────────────────────────────────────
// Called when Stripe sends us a payment event
export const handleStripeWebhook = async (
  rawBody: Buffer,
  signature: string
): Promise<void> => {
  let event: Stripe.Event;

  // Verify the webhook signature — confirms the request came from Stripe
  // If signature doesn't match, this throws and the request is rejected
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err) {
    throw ApiError.badRequest(`Webhook signature verification failed: ${err}`);
  }

  logger.info('Stripe webhook received', { type: event.type });

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handlePaymentSucceeded(session);
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handlePaymentFailed(session);
      break;
    }

    default:
      logger.debug('Unhandled Stripe webhook event', { type: event.type });
  }
};

// ── Payment succeeded ─────────────────────────────────────────────────────────
const handlePaymentSucceeded = async (session: Stripe.Checkout.Session): Promise<void> => {
  const appointmentId = session.metadata?.appointment_id;
  if (!appointmentId) return;

  // Update payment record
  await db.query(
    `UPDATE payments
     SET status = 'succeeded',
         provider_reference = $1,
         paid_at = NOW(),
         metadata = $2
     WHERE checkout_session_id = $3`,
    [
      session.payment_intent as string,
      JSON.stringify(session),
      session.id,
    ]
  );

  // Update appointment payment status
  await db.query(
    `UPDATE appointments SET payment_status = 'succeeded' WHERE id = $1`,
    [appointmentId]
  );

  // Fetch patient details to send SMS confirmation
  const patientResult = await db.query<{
    phone: string | null;
    first_name: string;
    last_name: string;
    doctor_first_name: string;
    doctor_last_name: string;
    appointment_date: string;
    consultation_fee: number;
  }>(
    `SELECT
       pu.phone,
       pu.first_name,
       pu.last_name,
       du.first_name   AS doctor_first_name,
       du.last_name    AS doctor_last_name,
       a.appointment_date,
       a.consultation_fee
     FROM appointments a
     JOIN users pu           ON pu.id = a.patient_id
     JOIN doctor_profiles dp ON dp.id = a.doctor_id
     JOIN users du           ON du.id = dp.user_id
     WHERE a.id = $1`,
    [appointmentId]
  );

  const patient = patientResult.rows[0];

  if (patient?.phone) {
    await smsService.sendPaymentConfirmation({
      phone: patient.phone,
      patientName: `${patient.first_name} ${patient.last_name}`,
      amount: patient.consultation_fee,
      reference: session.payment_intent as string,
      doctorName: `${patient.doctor_first_name} ${patient.doctor_last_name}`,
      date: patient.appointment_date,
    });
  }

  logger.info('Payment succeeded', { appointmentId, sessionId: session.id });
};

// ── Payment failed / expired ──────────────────────────────────────────────────
const handlePaymentFailed = async (session: Stripe.Checkout.Session): Promise<void> => {
  await db.query(
    `UPDATE payments SET status = 'failed' WHERE checkout_session_id = $1`,
    [session.id]
  );

  const appointmentId = session.metadata?.appointment_id;
  if (appointmentId) {
    await db.query(
      `UPDATE appointments SET payment_status = 'failed' WHERE id = $1`,
      [appointmentId]
    );
  }

  logger.info('Payment failed or expired', { sessionId: session.id });
};

// ── Get payment history for a patient ────────────────────────────────────────
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

// ── Initiate M-Pesa payment ───────────────────────────────────────────────────
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
    description: `Consultation fee`,
  });

  // Record a pending payment
  await db.query(
    `INSERT INTO payments
       (appointment_id, patient_id, provider, provider_reference, amount, currency, status, metadata)
     VALUES ($1, $2, 'mpesa', $3, $4, 'KES', 'pending', $5)`,
    [
      appt.id,
      patientId,
      checkoutRequestId,
      appt.consultation_fee,
      JSON.stringify({ merchantRequestId }),
    ]
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

// ── Handle M-Pesa callback ────────────────────────────────────────────────────
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
    // Update payment record to succeeded
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
      // Update appointment payment status
      await db.query(
        `UPDATE appointments SET payment_status = 'succeeded' WHERE id = $1`,
        [payment.appointment_id]
      );

      // Send SMS confirmation
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
    // Payment failed or cancelled by user
    await db.query(
      `UPDATE payments SET status = 'failed' WHERE provider_reference = $1`,
      [checkoutRequestId]
    );

    logger.info('M-Pesa payment failed', {
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
    });
  }
};

