import { db } from '../database/db';
import { logger } from '../config/logger';
import * as smsService from '../integrations/africas-talking/sms.service';

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  patient_phone: string | null;
  patient_first_name: string;
  patient_last_name: string;
  doctor_first_name: string;
  doctor_last_name: string;
}

export const sendAppointmentReminders = async (): Promise<void> => {
  logger.info('Running appointment reminder job');

  try {
    // Fetch all confirmed appointments scheduled for tomorrow
    const result = await db.query<UpcomingAppointment>(
      `SELECT
         a.id,
         a.appointment_date,
         a.start_time,
         pu.phone        AS patient_phone,
         pu.first_name   AS patient_first_name,
         pu.last_name    AS patient_last_name,
         du.first_name   AS doctor_first_name,
         du.last_name    AS doctor_last_name
       FROM appointments a
       JOIN users pu           ON pu.id = a.patient_id
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       JOIN users du           ON du.id = dp.user_id
       WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
         AND a.status = 'confirmed'
         AND pu.phone IS NOT NULL`
    );

    const appointments = result.rows;

    if (appointments.length === 0) {
      logger.info('No reminders to send today');
      return;
    }

    logger.info(`Sending reminders for ${appointments.length} appointment(s)`);

    // Send reminders concurrently — don't wait for one to finish before starting the next
    const results = await Promise.allSettled(
      appointments.map((appt) =>
        smsService.sendAppointmentReminder({
          phone: appt.patient_phone!,
          patientName: `${appt.patient_first_name} ${appt.patient_last_name}`,
          doctorName: `${appt.doctor_first_name} ${appt.doctor_last_name}`,
          date: appt.appointment_date,
          startTime: appt.start_time,
        })
      )
    );

    // Count successes and failures without crashing the job
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('Reminder job completed', { succeeded, failed, total: appointments.length });

  } catch (err) {
    // Log the error but do not throw — a crashed job should not crash the server
    logger.error('Reminder job failed', { error: err });
  }
};