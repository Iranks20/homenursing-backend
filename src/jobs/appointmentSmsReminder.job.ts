import cron from 'node-cron';
import { AppointmentSmsReminderService } from '../services/appointmentSmsReminder.service';
import { logger } from '../utils/logger';

const CRON_EXPRESSION = process.env.APPOINTMENT_SMS_CRON ?? '*/5 * * * *';

let started = false;

export const startAppointmentSmsReminderJob = (): void => {
  if (started) return;
  started = true;

  if (process.env.APPOINTMENT_SMS_CRON_ENABLED === 'false') {
    logger.info('Appointment SMS reminder cron is disabled');
    return;
  }

  cron.schedule(CRON_EXPRESSION, () => {
    AppointmentSmsReminderService.processDue()
      .then((summary) => {
        if (summary.processed > 0) {
          logger.info('Appointment SMS reminder batch finished', summary);
        }
      })
      .catch((error) => {
        logger.error('Appointment SMS reminder batch failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });

  logger.info('Appointment SMS reminder cron started', { expression: CRON_EXPRESSION });
};
