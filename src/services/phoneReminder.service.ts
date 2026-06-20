import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export type PhoneReminderStatus = 'scheduled' | 'sent' | 'cancelled';

export interface CreatePhoneReminderData {
  patientId: string;
  appointmentId?: string;
  message: string;
  scheduledAt: Date;
  phoneNumber: string;
  reminderType: string;
  // Additional fields from frontend
  title?: string;
  method?: 'sms' | 'call' | 'both';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  maxAttempts?: number;
  patientName?: string;
}

export interface UpdatePhoneReminderData {
  appointmentId?: string;
  message?: string;
  scheduledAt?: Date;
  phoneNumber?: string;
  reminderType?: string;
  status?: PhoneReminderStatus;
  // Additional fields from frontend
  title?: string;
  method?: 'sms' | 'call' | 'both';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  maxAttempts?: number;
  patientName?: string;
}

export interface PhoneReminderRecord {
  id: string;
  patientId: string;
  appointmentId?: string;
  message: string;
  scheduledAt: string;
  phoneNumber: string;
  reminderType: string;
  status: PhoneReminderStatus;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  // Additional fields from frontend
  title?: string;
  method?: 'sms' | 'call' | 'both';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  maxAttempts?: number;
  patientName?: string;
  attempts?: number;
  lastAttempt?: string;
  response?: string;
}

const REMINDER_PREFIX = 'phone_reminder_';
const REMINDER_CATEGORY = 'reminder_phone';

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const mapRecord = (record: Prisma.SystemConfigGetPayload<{}>): PhoneReminderRecord | null => {
  if (!record.key.startsWith(REMINDER_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const reminder: PhoneReminderRecord = {
    id: record.id,
    patientId: String(value.patientId ?? ''),
    message: String(value.message ?? ''),
    scheduledAt: String(value.scheduledAt ?? new Date().toISOString()),
    phoneNumber: String(value.phoneNumber ?? ''),
    reminderType: String(value.reminderType ?? ''),
    status: (value.status as PhoneReminderStatus) ?? 'scheduled',
    createdAt: String(value.createdAt ?? new Date().toISOString()),
  };

  if (value.appointmentId !== undefined) reminder.appointmentId = String(value.appointmentId);
  if (value.updatedAt !== undefined) reminder.updatedAt = String(value.updatedAt);
  if (value.sentAt !== undefined) reminder.sentAt = String(value.sentAt);
  if (value.cancelledAt !== undefined) reminder.cancelledAt = String(value.cancelledAt);
  
  // Additional fields from frontend
  if (value.title !== undefined) reminder.title = String(value.title);
  if (value.method !== undefined) reminder.method = value.method as 'sms' | 'call' | 'both';
  if (value.priority !== undefined) reminder.priority = value.priority as 'low' | 'medium' | 'high' | 'urgent';
  if (value.maxAttempts !== undefined) reminder.maxAttempts = Number(value.maxAttempts);
  if (value.patientName !== undefined) reminder.patientName = String(value.patientName);
  if (value.attempts !== undefined) reminder.attempts = Number(value.attempts);
  if (value.lastAttempt !== undefined) reminder.lastAttempt = String(value.lastAttempt);
  if (value.response !== undefined) reminder.response = String(value.response);

  return reminder;
};

const buildCreateValue = (data: CreatePhoneReminderData): Prisma.InputJsonObject => {
  const value: Record<string, unknown> = {
    patientId: data.patientId,
    message: data.message,
    scheduledAt: data.scheduledAt.toISOString(),
    phoneNumber: data.phoneNumber,
    reminderType: data.reminderType,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  // Optional fields
  if (data.appointmentId !== undefined) value.appointmentId = data.appointmentId;
  if (data.title !== undefined) value.title = data.title;
  if (data.method !== undefined) value.method = data.method;
  if (data.priority !== undefined) value.priority = data.priority;
  if (data.maxAttempts !== undefined) value.maxAttempts = data.maxAttempts;
  if (data.patientName !== undefined) value.patientName = data.patientName;

  return value as Prisma.InputJsonObject;
};

export class PhoneReminderService {
  static async createReminder(data: CreatePhoneReminderData): Promise<PhoneReminderRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${REMINDER_PREFIX}${Date.now()}`,
        category: REMINDER_CATEGORY,
        value: buildCreateValue(data),
      },
    });

    logger.info('Phone reminder created', { reminderId: record.id });

    const mapped = mapRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to create reminder', 500);
    }
    return mapped;
  }

  static async getReminders(patientId?: string, page = 1, limit = 10): Promise<{ reminders: PhoneReminderRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;

    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: REMINDER_PREFIX },
    };

    if (patientId) {
      where.value = {
        path: ['patientId'],
        equals: patientId,
      } as Prisma.JsonFilter;
    }

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const reminders = records
      .map(mapRecord)
      .filter((reminder): reminder is PhoneReminderRecord => reminder !== null);

    return {
      reminders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getReminderById(id: string): Promise<PhoneReminderRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return mapRecord(record);
  }

  static async ensureReminderRecord(id: string): Promise<{ record: Prisma.SystemConfigGetPayload<{}>; mapped: PhoneReminderRecord }> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(REMINDER_PREFIX)) {
      throw new CustomError('Reminder not found', 404);
    }
    const mapped = mapRecord(record);
    if (!mapped) {
      throw new CustomError('Reminder not found', 404);
    }
    return { record, mapped };
  }

  static async updateReminder(id: string, data: UpdatePhoneReminderData): Promise<PhoneReminderRecord> {
    const { record } = await this.ensureReminderRecord(id);
    const current = toJsonObject(record.value);

    const updates: Prisma.JsonObject = { ...current };

    if (data.appointmentId !== undefined) updates.appointmentId = data.appointmentId;
    if (data.message !== undefined) updates.message = data.message;
    if (data.scheduledAt !== undefined) updates.scheduledAt = data.scheduledAt.toISOString();
    if (data.phoneNumber !== undefined) updates.phoneNumber = data.phoneNumber;
    if (data.reminderType !== undefined) updates.reminderType = data.reminderType;
    if (data.status !== undefined) updates.status = data.status;
    
    // Additional fields from frontend
    if (data.title !== undefined) updates.title = data.title;
    if (data.method !== undefined) updates.method = data.method;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.maxAttempts !== undefined) updates.maxAttempts = data.maxAttempts;
    if (data.patientName !== undefined) updates.patientName = data.patientName;

    updates.updatedAt = new Date().toISOString();

    const updatedRecord = await prisma.systemConfig.update({
      where: { id },
      data: { value: updates as Prisma.InputJsonObject },
    });

    logger.info('Phone reminder updated', { reminderId: id });
    const mapped = mapRecord(updatedRecord);
    if (!mapped) {
      throw new CustomError('Reminder not found', 404);
    }
    return mapped;
  }

  static async deleteReminder(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(REMINDER_PREFIX)) {
      throw new CustomError('Reminder not found', 404);
    }

    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Phone reminder deleted', { reminderId: id });
  }

  static async sendReminder(id: string): Promise<{ message: string; reminderId: string }> {
    const { record } = await this.ensureReminderRecord(id);
    logger.info('Phone reminder sent', { reminderId: id });

    const current = toJsonObject(record.value);
    current.status = 'sent';
    current.sentAt = new Date().toISOString();

    await prisma.systemConfig.update({
      where: { id },
      data: { value: current as Prisma.InputJsonObject },
    });

    return { message: 'Reminder sent successfully', reminderId: id };
  }

  static async cancelReminder(id: string): Promise<{ message: string }> {
    const { record } = await this.ensureReminderRecord(id);

    const current = toJsonObject(record.value);
    current.status = 'cancelled';
    current.cancelledAt = new Date().toISOString();

    await prisma.systemConfig.update({
      where: { id },
      data: { value: current as Prisma.InputJsonObject },
    });

    logger.info('Phone reminder cancelled', { reminderId: id });
    return { message: 'Reminder cancelled successfully' };
  }

  static async getTemplates() {
    return [
      {
        id: 'appointment',
        name: 'Appointment Reminder',
        message: 'Reminder: You have an appointment on {{date}} at {{time}} with {{provider}}.',
      },
      {
        id: 'medication',
        name: 'Medication Reminder',
        message: 'Reminder: Please take your medication {{medication}} at {{time}}.',
      },
      {
        id: 'payment',
        name: 'Payment Reminder',
        message: 'Reminder: Your payment of {{amount}} is due on {{dueDate}}.',
      },
    ];
  }
}

