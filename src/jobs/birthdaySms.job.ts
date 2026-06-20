import cron from 'node-cron';
import { BirthdaySmsService } from '../services/birthdaySms.service';
import { logger } from '../utils/logger';

const SCHEDULE_CRON = process.env.BIRTHDAY_SMS_SCHEDULE_CRON ?? '5 0 * * *';
const SEND_CRON = process.env.BIRTHDAY_SMS_SEND_CRON ?? '*/10 * * * *';

let started = false;

export const startBirthdaySmsJob = (): void => {
  if (started) return;
  started = true;

  if (process.env.BIRTHDAY_SMS_CRON_ENABLED === 'false') {
    logger.info('Birthday SMS cron is disabled');
    return;
  }

  cron.schedule(SCHEDULE_CRON, () => {
    BirthdaySmsService.scheduleTodaysBirthdays()
      .then((count) => {
        if (count > 0) {
          logger.info('Birthday SMS schedule run', { scheduled: count });
        }
      })
      .catch((error) => {
        logger.error('Birthday SMS schedule failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });

  cron.schedule(SEND_CRON, () => {
    BirthdaySmsService.processDue()
      .then((summary) => {
        if (summary.processed > 0) {
          logger.info('Birthday SMS send batch finished', summary);
        }
      })
      .catch((error) => {
        logger.error('Birthday SMS send batch failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });

  logger.info('Birthday SMS cron started', {
    scheduleCron: SCHEDULE_CRON,
    sendCron: SEND_CRON,
  });
};
