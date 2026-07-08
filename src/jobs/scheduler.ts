import cron from 'node-cron';
import { logger } from '../config/logger';
import { sendAppointmentReminders } from './reminderJob';

export const startScheduler = (): void => {
  logger.info('Starting job scheduler');

  // ── Daily appointment reminders ─────────────────────────────────────────────
  // Runs every day at 08:00 AM (Nairobi time is UTC+3)
  // Cron format: second(optional) minute hour day month weekday
  cron.schedule(
    '0 8 * * *',
    async () => {
      logger.info('Cron: running daily reminder job');
      await sendAppointmentReminders();
    },
    {
      timezone: 'Africa/Nairobi',
    }
  );

  logger.info('Scheduler started — daily reminders at 08:00 Africa/Nairobi');
};