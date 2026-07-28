import Stripe from 'stripe';
import { stripe } from '../../integrations/stripe/stripe.client';
import { db } from '../../database/db';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import * as smsService from '../../integrations/africas-talking/sms.service';
import { CreateCheckoutSessionInput } from './payments.schema';

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

export const createCheckoutSession = async (
  patientId: string,
  input: CreateCheckoutSessionInput
): Promise<{ checkout_url: string; payment_id: string }> => {
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
       pu.email        AS patient_email
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

  const successUrl = env.STRIPE_SUCCESS_URL?.replace('localhost:3001', env.APP_URL ?? 'localhost:3001');
  const cancelUrl = env.STRIPE_CANCEL_URL?.replace('localhost:3001', env.APP_URL ?? 'localhost:3001');

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
          unit_amount: Math.round(appt.consultation_fee * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      appointment_id: appt.id,
      patient_id: patientId,
    },
  });

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

  await db.query(`UPDATE appointments SET payment_id = $1 WHERE id = $2`, [paymentResult.rows[0].id, appt.id]);

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

export const handleStripeWebhook = async (
  rawBody: Buffer,
  signature: string
): Promise<void> => {
  let event: Stripe.Event;

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

const handlePaymentSucceeded = async (session: Stripe.Checkout.Session): Promise<void> => {
  const appointmentId = session.metadata?.appointment_id;
  if (!appointmentId) return;

  await db.query(
    `UPDATE payments
     SET status = 'succeeded',
         provider_reference = $1,
         paid_at = NOW(),
         metadata = $2
     WHERE checkout_session_id = $3`,
    [session.payment_intent as string, JSON.stringify(session), session.id]
  );

  await db.query(`UPDATE appointments SET payment_status = 'succeeded' WHERE id = $1`, [appointmentId]);

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

const handlePaymentFailed = async (session: Stripe.Checkout.Session): Promise<void> => {
  await db.query(`UPDATE payments SET status = 'failed' WHERE checkout_session_id = $1`, [session.id]);

  const appointmentId = session.metadata?.appointment_id;
  if (appointmentId) {
    await db.query(`UPDATE appointments SET payment_status = 'failed' WHERE id = $1`, [appointmentId]);
  }

  logger.info('Payment failed or expired', { sessionId: session.id });
};
