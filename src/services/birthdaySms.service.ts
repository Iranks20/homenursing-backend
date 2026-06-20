import { BirthdaySmsDeliveryStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { SmsService } from './sms.service';
import { SmsAutomationService } from './smsAutomation.service';
import { isLikelyValidPhone, normalizePhoneNumber } from './egoSms.service';
import { computeBirthdaySendAt } from '../utils/appointmentReminderSchedule';
import { collectBirthdayRecipientsForDate } from '../utils/birthdayRecipients';

export interface BirthdaySmsDeliveryRecord {
  id: string;
  recipientType: string;
  recipientId: string;
  calendarYear: number;
  recipientName: string;
  phone: string;
  scheduledAt: string;
  status: BirthdaySmsDeliveryStatus;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

const mapRow = (
  row: Prisma.BirthdaySmsDeliveryGetPayload<Record<string, never>>
): BirthdaySmsDeliveryRecord => {
  const record: BirthdaySmsDeliveryRecord = {
    id: row.id,
    recipientType: row.recipientType,
    recipientId: row.recipientId,
    calendarYear: row.calendarYear,
    recipientName: row.recipientName,
    phone: row.phone,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.sentAt) record.sentAt = row.sentAt.toISOString();
  if (row.errorMessage) record.errorMessage = row.errorMessage;
  return record;
};

export class BirthdaySmsService {
  static async scheduleTodaysBirthdays(referenceDate: Date = new Date()): Promise<number> {
    const settings = await SmsAutomationService.getSettings();
    if (!settings.birthdaySmsEnabled) {
      return 0;
    }

    const year = referenceDate.getUTCFullYear();
    const candidates = await collectBirthdayRecipientsForDate(referenceDate);
    const scheduledAt = computeBirthdaySendAt(referenceDate, settings.birthdaySendHourUtc, referenceDate);
    let created = 0;

    for (const candidate of candidates) {
      const existing = await prisma.birthdaySmsDelivery.findUnique({
        where: {
          recipientType_recipientId_calendarYear: {
            recipientType: candidate.recipientType,
            recipientId: candidate.recipientId,
            calendarYear: year,
          },
        },
      });
      if (existing) {
        continue;
      }

      await prisma.birthdaySmsDelivery.create({
        data: {
          recipientType: candidate.recipientType,
          recipientId: candidate.recipientId,
          calendarYear: year,
          recipientName: candidate.recipientName,
          phone: candidate.phone,
          scheduledAt,
          status: BirthdaySmsDeliveryStatus.SCHEDULED,
        },
      });
      created += 1;
    }

    if (created > 0) {
      logger.info('Birthday SMS deliveries scheduled', { count: created, year });
    }

    return created;
  }

  static async processDue(referenceDate: Date = new Date()): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const settings = await SmsAutomationService.getSettings();
    if (!settings.birthdaySmsEnabled) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    await this.scheduleTodaysBirthdays(referenceDate);

    const due = await prisma.birthdaySmsDelivery.findMany({
      where: {
        status: BirthdaySmsDeliveryStatus.SCHEDULED,
        scheduledAt: { lte: referenceDate },
      },
      take: 100,
      orderBy: { scheduledAt: 'asc' },
    });

    let sent = 0;
    let failed = 0;

    for (const row of due) {
      const phone = normalizePhoneNumber(row.phone);
      if (!isLikelyValidPhone(phone)) {
        await prisma.birthdaySmsDelivery.update({
          where: { id: row.id },
          data: {
            status: BirthdaySmsDeliveryStatus.FAILED,
            errorMessage: 'Invalid or missing phone number',
          },
        });
        failed += 1;
        continue;
      }

      try {
        const birthdayPayload: Parameters<typeof SmsService.sendBirthdayGreeting>[0] = {
          recipientName: row.recipientName,
          phone,
        };
        if (row.recipientType === 'PATIENT') {
          birthdayPayload.patientId = row.recipientId;
        }
        const sms = await SmsService.sendBirthdayGreeting(birthdayPayload);

        const ok = sms && (sms.status === 'sent' || sms.status === 'partial');
        await prisma.birthdaySmsDelivery.update({
          where: { id: row.id },
          data: {
            status: ok ? BirthdaySmsDeliveryStatus.SENT : BirthdaySmsDeliveryStatus.FAILED,
            sentAt: ok ? new Date() : null,
            smsMessageId: sms?.id ?? null,
            errorMessage: ok ? null : 'SMS provider reported failure',
          },
        });
        if (ok) sent += 1;
        else failed += 1;
      } catch (error) {
        await prisma.birthdaySmsDelivery.update({
          where: { id: row.id },
          data: {
            status: BirthdaySmsDeliveryStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
        failed += 1;
      }
    }

    return { processed: due.length, sent, failed };
  }

  static async list(options: {
    view: 'upcoming' | 'delivered';
    page?: number;
    limit?: number;
  }): Promise<{
    deliveries: BirthdaySmsDeliveryRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BirthdaySmsDeliveryWhereInput =
      options.view === 'upcoming'
        ? { status: BirthdaySmsDeliveryStatus.SCHEDULED }
        : {
            OR: [
              { status: BirthdaySmsDeliveryStatus.SENT },
              { status: BirthdaySmsDeliveryStatus.FAILED },
            ],
          };

    const [rows, total] = await Promise.all([
      prisma.birthdaySmsDelivery.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          options.view === 'upcoming'
            ? [{ scheduledAt: 'asc' }]
            : [{ sentAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.birthdaySmsDelivery.count({ where }),
    ]);

    return {
      deliveries: rows.map(mapRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
