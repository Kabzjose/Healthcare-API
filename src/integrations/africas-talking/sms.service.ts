import AfricasTalking from 'africastalking';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// Initialise the Africa's Talking client
const AT = AfricasTalking({
  apiKey: env.AT_API_KEY as string,
  username: env.AT_USERNAME,
});

const sms = AT.SMS;

// ── Core send function ────────────────────────────────────────────────────────
const sendSMS = async (to: string | string[], message: string): Promise<void> => {
  try {
    const recipients = Array.isArray(to) ? to : [to];

    // Africa's Talking requires numbers in international format e.g. +254712345678
    const response = await sms.send({
      to: recipients,
      message,
      from: env.AT_SENDER_ID,
    });

    logger.info('SMS sent', {
      recipients,
      messageId: response.SMSMessageData?.Message,
    });
  } catch (err) {
    // Log but do not throw — SMS failure should never break the booking flow
    logger.error('SMS send failed', { error: err, to });
  }
};

// ── Appointment booked — notify patient ───────────────────────────────────────
export const sendBookingConfirmationToPatient = async (params: {
  phone: string;
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  fee: number;
}): Promise<void> => {
  const message =
    `Hello ${params.patientName}, your appointment with Dr. ${params.doctorName} ` +
    `is confirmed for ${params.date} at ${params.startTime}. ` +
    `Consultation fee: KES ${params.fee}. ` +
    `Reply CANCEL to cancel. - HealthCare`;

  await sendSMS(params.phone, message);
};

// ── Appointment booked — notify doctor ────────────────────────────────────────
export const sendBookingNotificationToDoctor = async (params: {
  phone: string;
  doctorName: string;
  patientName: string;
  date: string;
  startTime: string;
  reason?: string;
}): Promise<void> => {
  const message =
    `Hello Dr. ${params.doctorName}, you have a new appointment with ` +
    `${params.patientName} on ${params.date} at ${params.startTime}. ` +
    `${params.reason ? `Reason: ${params.reason}.` : ''} - HealthCare`;

  await sendSMS(params.phone, message);
};

// ── Appointment confirmed by doctor — notify patient ──────────────────────────
export const sendAppointmentConfirmedToPatient = async (params: {
  phone: string;
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
}): Promise<void> => {
  const message =
    `Hello ${params.patientName}, Dr. ${params.doctorName} has confirmed your ` +
    `appointment on ${params.date} at ${params.startTime}. ` +
    `Please arrive 10 minutes early. - HealthCare`;

  await sendSMS(params.phone, message);
};

// ── Appointment cancelled — notify both parties ───────────────────────────────
export const sendCancellationNotification = async (params: {
  patientPhone: string;
  doctorPhone: string;
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  cancelledBy: 'patient' | 'doctor';
}): Promise<void> => {
  const patientMessage =
    `Hello ${params.patientName}, your appointment with Dr. ${params.doctorName} ` +
    `on ${params.date} at ${params.startTime} has been cancelled. ` +
    `Please book a new appointment. - HealthCare`;

  const doctorMessage =
    `Hello Dr. ${params.doctorName}, the appointment with ${params.patientName} ` +
    `on ${params.date} at ${params.startTime} has been cancelled by the ${params.cancelledBy}. ` +
    `- HealthCare`;

  // Send both simultaneously — Promise.all fires both at the same time
  await Promise.all([
    sendSMS(params.patientPhone, patientMessage),
    sendSMS(params.doctorPhone, doctorMessage),
  ]);
};

// ── 24-hour reminder — notify patient ────────────────────────────────────────
// This will be called by a scheduled job in Phase 3
export const sendAppointmentReminder = async (params: {
  phone: string;
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  location?: string;
}): Promise<void> => {
  const message =
    `Reminder: Hello ${params.patientName}, you have an appointment with ` +
    `Dr. ${params.doctorName} tomorrow ${params.date} at ${params.startTime}. ` +
    `${params.location ? `Location: ${params.location}.` : ''} - HealthCare`;

  await sendSMS(params.phone, message);
};

// ── Payment received — notify patient ─────────────────────────────────────────
export const sendPaymentConfirmation = async (params: {
  phone: string;
  patientName: string;
  amount: number;
  reference: string;
  doctorName: string;
  date: string;
}): Promise<void> => {
  const message =
    `Hello ${params.patientName}, payment of KES ${params.amount} received ` +
    `for your appointment with Dr. ${params.doctorName} on ${params.date}. ` +
    `Ref: ${params.reference}. - HealthCare`;

  await sendSMS(params.phone, message);
};