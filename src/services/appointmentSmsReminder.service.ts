import {
  AppointmentReminderTiming,
  AppointmentSmsReminderStatus,
  AppointmentStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { SmsService } from './sms.service';
import { SmsAutomationService } from './smsAutomation.service';
import { isLikelyValidPhone, normalizePhoneNumber } from './egoSms.service';
import {
  combineAppointmentDateAndTime,
  computeAppointmentReminderSendAt,
  normalizeAppointmentDate,
  type AppointmentReminderTiming as ReminderTimingValue,
} from '../utils/appointmentReminderSchedule';

const INACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
];

const appointmentInclude = {
  patient: true,
  nurse: true,
  specialist: true,
  therapist: true,
  service: true,
} as const;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export interface AppointmentSmsReminderRecord {
  id: string;
  appointmentId: string;
  scheduledAt: string;
  status: AppointmentSmsReminderStatus;
  patientName: string;
  patientPhone: string;
  patientSentAt?: string;
  patientSendError?: string;
  providerType?: string;
  providerName?: string;
  providerPhone?: string;
  providerSentAt?: string;
  providerSendError?: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceName?: string;
  reminderTiming: AppointmentReminderTiming;
  createdAt: string;
  updatedAt: string;
}

type ProviderSnapshot = {
  providerType: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
};

export { computeAppointmentReminderSendAt } from '../utils/appointmentReminderSchedule';

const resolveProvider = (appointment: AppointmentWithRelations): ProviderSnapshot | null => {
  if (appointment.specialist) {
    return {
      providerType: 'specialist',
      providerId: appointment.specialist.id,
      providerName: appointment.specialist.name,
      providerPhone: appointment.specialist.phone,
    };
  }
  if (appointment.therapist) {
    return {
      providerType: 'therapist',
      providerId: appointment.therapist.id,
      providerName: appointment.therapist.name,
      providerPhone: appointment.therapist.phone,
    };
  }
  if (appointment.nurse) {
    return {
      providerType: 'nurse',
      providerId: appointment.nurse.id,
      providerName: appointment.nurse.name,
      providerPhone: appointment.nurse.phone,
    };
  }
  return null;
};

const mapRecord = (
  row: Prisma.AppointmentSmsReminderGetPayload<Record<string, never>>
): AppointmentSmsReminderRecord => {
  const record: AppointmentSmsReminderRecord = {
    id: row.id,
    appointmentId: row.appointmentId,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    appointmentDate: row.appointmentDate.toISOString(),
    appointmentTime: row.appointmentTime,
    reminderTiming: row.reminderTiming,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.patientSentAt) record.patientSentAt = row.patientSentAt.toISOString();
  if (row.patientSendError) record.patientSendError = row.patientSendError;
  if (row.providerType) record.providerType = row.providerType;
  if (row.providerName) record.providerName = row.providerName;
  if (row.providerPhone) record.providerPhone = row.providerPhone;
  if (row.providerSentAt) record.providerSentAt = row.providerSentAt.toISOString();
  if (row.providerSendError) record.providerSendError = row.providerSendError;
  if (row.serviceName) record.serviceName = row.serviceName;
  return record;
};

export class AppointmentSmsReminderService {
  static async syncForAppointment(
    appointment: AppointmentWithRelations,
    options: {
      patientPhoneOverride?: string;
      enabled: boolean;
      reminderTiming?: ReminderTimingValue;
    }
  ): Promise<AppointmentSmsReminderRecord | null> {
    if (!options.enabled) {
      await this.cancelForAppointment(appointment.id);
      return null;
    }

    if (INACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      await this.cancelForAppointment(appointment.id);
      return null;
    }

    const appointmentAt = combineAppointmentDateAndTime(appointment.date, appointment.time);
    if (appointmentAt.getTime() <= Date.now()) {
      await this.cancelForAppointment(appointment.id, AppointmentSmsReminderStatus.SKIPPED);
      return null;
    }

    const automation = await SmsAutomationService.getSettings();
    const reminderTiming = SmsAutomationService.resolveAppointmentTiming(
      options.reminderTiming,
      automation
    );
    const scheduledAt = computeAppointmentReminderSendAt(
      appointment.date,
      appointment.time,
      reminderTiming,
      {
        midDayUtcHour: automation.midDayReminderHourUtc,
      }
    );

    const patientPhone =
      options.patientPhoneOverride?.trim() ||
      appointment.patient?.phone?.trim() ||
      '';
    const provider = resolveProvider(appointment);

    const data = {
      scheduledAt,
      reminderTiming,
      status: AppointmentSmsReminderStatus.SCHEDULED,
      patientName: appointment.patient?.name ?? 'Patient',
      patientPhone,
      patientSentAt: null,
      patientSmsMessageId: null,
      patientSendError: null,
      providerType: provider?.providerType ?? null,
      providerId: provider?.providerId ?? null,
      providerName: provider?.providerName ?? null,
      providerPhone: provider?.providerPhone ?? null,
      providerSentAt: null,
      providerSmsMessageId: null,
      providerSendError: null,
      appointmentDate: normalizeAppointmentDate(appointment.date),
      appointmentTime: appointment.time,
      serviceName: appointment.service?.name ?? null,
    };

    const row = await prisma.appointmentSmsReminder.upsert({
      where: { appointmentId: appointment.id },
      create: {
        appointmentId: appointment.id,
        ...data,
      },
      update: data,
    });

    logger.info('Appointment SMS reminder scheduled', {
      appointmentId: appointment.id,
      scheduledAt: scheduledAt.toISOString(),
      reminderTiming,
    });

    return mapRecord(row);
  }

  static async cancelForAppointment(
    appointmentId: string,
    status: AppointmentSmsReminderStatus = AppointmentSmsReminderStatus.CANCELLED
  ): Promise<void> {
    const existing = await prisma.appointmentSmsReminder.findUnique({
      where: { appointmentId },
    });
    if (!existing) return;
    if (
      existing.status === AppointmentSmsReminderStatus.SENT ||
      existing.status === AppointmentSmsReminderStatus.PARTIAL
    ) {
      return;
    }

    await prisma.appointmentSmsReminder.update({
      where: { appointmentId },
      data: { status },
    });
  }

  static async list(options: {
    view: 'upcoming' | 'delivered';
    page?: number;
    limit?: number;
  }): Promise<{
    reminders: AppointmentSmsReminderRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentSmsReminderWhereInput =
      options.view === 'upcoming'
        ? {
            status: AppointmentSmsReminderStatus.SCHEDULED,
            appointment: {
              status: { notIn: INACTIVE_APPOINTMENT_STATUSES },
            },
          }
        : {
            OR: [
              { status: AppointmentSmsReminderStatus.SENT },
              { status: AppointmentSmsReminderStatus.PARTIAL },
              { status: AppointmentSmsReminderStatus.FAILED },
              { patientSentAt: { not: null } },
              { providerSentAt: { not: null } },
            ],
          };

    const [rows, total] = await Promise.all([
      prisma.appointmentSmsReminder.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          options.view === 'upcoming'
            ? [{ scheduledAt: 'asc' }]
            : [{ patientSentAt: 'desc' }, { providerSentAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.appointmentSmsReminder.count({ where }),
    ]);

    return {
      reminders: rows.map(mapRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async processDue(): Promise<{ processed: number; sent: number; failed: number }> {
    const now = new Date();
    const due = await prisma.appointmentSmsReminder.findMany({
      where: {
        status: AppointmentSmsReminderStatus.SCHEDULED,
        scheduledAt: { lte: now },
        appointment: {
          status: { notIn: INACTIVE_APPOINTMENT_STATUSES },
        },
      },
      include: { appointment: { include: appointmentInclude } },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    });

    let sent = 0;
    let failed = 0;

    for (const reminder of due) {
      const result = await this.dispatchReminder(reminder);
      if (result === 'sent') sent += 1;
      if (result === 'failed') failed += 1;
    }

    return { processed: due.length, sent, failed };
  }

  private static async dispatchReminder(
    reminder: Prisma.AppointmentSmsReminderGetPayload<{
      include: { appointment: { include: typeof appointmentInclude } };
    }>
  ): Promise<'sent' | 'failed' | 'skipped'> {
    const appointment = reminder.appointment;
    if (INACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) {
      await prisma.appointmentSmsReminder.update({
        where: { id: reminder.id },
        data: { status: AppointmentSmsReminderStatus.CANCELLED },
      });
      return 'skipped';
    }

    const appointmentAt = combineAppointmentDateAndTime(appointment.date, appointment.time);
    if (appointmentAt.getTime() <= Date.now()) {
      await prisma.appointmentSmsReminder.update({
        where: { id: reminder.id },
        data: { status: AppointmentSmsReminderStatus.SKIPPED },
      });
      return 'skipped';
    }

    const dateLabel = new Date(appointment.date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const serviceName = appointment.service?.name ?? reminder.serviceName ?? null;
    const providerName =
      appointment.specialist?.name ||
      appointment.therapist?.name ||
      appointment.nurse?.name ||
      reminder.providerName ||
      null;

    let patientOk = false;
    let providerOk = false;
    let patientError: string | undefined;
    let providerError: string | undefined;
    let patientSmsMessageId: string | undefined;
    let providerSmsMessageId: string | undefined;

    const patientPhone = normalizePhoneNumber(reminder.patientPhone);
    if (isLikelyValidPhone(patientPhone)) {
      try {
        const record = await SmsService.sendAppointmentReminderToPatient({
          patientId: appointment.patientId,
          patientName: reminder.patientName,
          patientPhone,
          date: appointment.date,
          time: appointment.time,
          serviceName,
          providerName,
          appointmentId: appointment.id,
        });
        if (record) {
          patientOk = record.status === 'sent' || record.status === 'partial';
          patientSmsMessageId = record.id;
          if (!patientOk) patientError = 'SMS provider reported failure';
        } else {
          patientError = 'Invalid patient phone';
        }
      } catch (error) {
        patientError = error instanceof Error ? error.message : String(error);
      }
    } else {
      patientError = 'Invalid or missing patient phone';
    }

    const providerPhone = reminder.providerPhone
      ? normalizePhoneNumber(reminder.providerPhone)
      : '';
    if (!reminder.providerPhone) {
      providerError = 'No assigned provider';
    } else if (!isLikelyValidPhone(providerPhone)) {
      providerError = 'Invalid provider phone';
    } else {
      try {
        const record = await SmsService.sendAppointmentReminderToProvider({
          providerName: reminder.providerName ?? 'Provider',
          providerPhone,
          patientName: reminder.patientName,
          date: appointment.date,
          time: appointment.time,
          serviceName,
          appointmentId: appointment.id,
        });
        if (record) {
          providerOk = record.status === 'sent' || record.status === 'partial';
          providerSmsMessageId = record.id;
          if (!providerOk) providerError = 'SMS provider reported failure';
        } else {
          providerError = 'SMS send returned no record';
        }
      } catch (error) {
        providerError = error instanceof Error ? error.message : String(error);
      }
    }

    const now = new Date();
    const expectsProvider = Boolean(reminder.providerPhone);
    let status: AppointmentSmsReminderStatus;

    if (patientOk && (!expectsProvider || providerOk)) {
      status = AppointmentSmsReminderStatus.SENT;
    } else if (patientOk || providerOk) {
      status = AppointmentSmsReminderStatus.PARTIAL;
    } else {
      status = AppointmentSmsReminderStatus.FAILED;
    }

    await prisma.appointmentSmsReminder.update({
      where: { id: reminder.id },
      data: {
        status,
        patientSentAt: patientOk ? now : null,
        patientSmsMessageId: patientSmsMessageId ?? null,
        patientSendError: patientError ?? null,
        providerSentAt: providerOk ? now : null,
        providerSmsMessageId: providerSmsMessageId ?? null,
        providerSendError: providerError ?? null,
      },
    });

    if (status === AppointmentSmsReminderStatus.SENT || status === AppointmentSmsReminderStatus.PARTIAL) {
      return 'sent';
    }
    return 'failed';
  }
}
