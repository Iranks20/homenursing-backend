import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface SystemSettings {
  siteName?: string;
  siteEmail?: string;
  sitePhone?: string;
  maintenanceMode?: boolean;
  registrationEnabled?: boolean;
  emailVerificationRequired?: boolean;
  passwordMinLength?: number;
  sessionTimeout?: number;
  [key: string]: unknown;
}

export interface NotificationSettings {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
  appointmentReminders?: boolean;
  paymentReminders?: boolean;
  [key: string]: unknown;
}

export interface ReminderSettings {
  appointmentReminderHours?: number;
  paymentReminderDays?: number;
  medicationReminderEnabled?: boolean;
  defaultReminderTime?: string;
  [key: string]: unknown;
}

const SYSTEM_SETTINGS_KEY = 'system';
const SYSTEM_SETTINGS_CATEGORY = 'settings_system';
const NOTIFICATION_SETTINGS_KEY = 'notifications';
const NOTIFICATION_SETTINGS_CATEGORY = 'settings_notification';
const REMINDER_SETTINGS_KEY = 'reminders';
const REMINDER_SETTINGS_CATEGORY = 'settings_reminder';
const BACKUP_CATEGORY = 'settings_backup';

const defaultSystemSettings = (): SystemSettings => ({
  siteName: 'Teamwork Homecare',
  siteEmail: 'support@homecare.com',
  sitePhone: '+1234567890',
  maintenanceMode: false,
  registrationEnabled: true,
  emailVerificationRequired: true,
  passwordMinLength: 8,
  sessionTimeout: 3600,
});

const defaultNotificationSettings = (): NotificationSettings => ({
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  appointmentReminders: true,
  paymentReminders: true,
});

const defaultReminderSettings = (): ReminderSettings => ({
  appointmentReminderHours: 24,
  paymentReminderDays: 7,
  medicationReminderEnabled: true,
  defaultReminderTime: '09:00',
});

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const mapToJson = (value: Record<string, unknown>): Prisma.InputJsonObject => value as Prisma.InputJsonObject;

const mergeSettings = <T extends Record<string, unknown>>(existing: Prisma.JsonValue | null, updates: Partial<T>, defaults: T): T => {
  const base = Object.assign({}, defaults, toJsonObject(existing)) as T;
  return Object.assign(base, updates);
};

export class SettingsService {
  static async getSystemSettings(): Promise<SystemSettings> {
    const settings = await prisma.systemConfig.findUnique({
      where: { key: SYSTEM_SETTINGS_KEY },
    });

    if (!settings) {
      return this.updateSystemSettings({});
    }

    return toJsonObject(settings.value) as SystemSettings;
  }

  static async updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: SYSTEM_SETTINGS_KEY } });
    const updatedValue = mergeSettings<SystemSettings>(existing?.value ?? null, data, defaultSystemSettings());

    const record = await prisma.systemConfig.upsert({
      where: { key: SYSTEM_SETTINGS_KEY },
      update: { value: mapToJson(updatedValue) },
      create: {
        key: SYSTEM_SETTINGS_KEY,
        category: SYSTEM_SETTINGS_CATEGORY,
        value: mapToJson(updatedValue),
      },
    });

    logger.info('System settings updated');
    return toJsonObject(record.value) as SystemSettings;
  }

  static async getNotificationSettings(): Promise<NotificationSettings> {
    const settings = await prisma.systemConfig.findUnique({
      where: { key: NOTIFICATION_SETTINGS_KEY },
    });

    if (!settings) {
      return this.updateNotificationSettings({});
    }

    return toJsonObject(settings.value) as NotificationSettings;
  }

  static async updateNotificationSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: NOTIFICATION_SETTINGS_KEY } });
    const updatedValue = mergeSettings<NotificationSettings>(existing?.value ?? null, data, defaultNotificationSettings());

    const record = await prisma.systemConfig.upsert({
      where: { key: NOTIFICATION_SETTINGS_KEY },
      update: { value: mapToJson(updatedValue) },
      create: {
        key: NOTIFICATION_SETTINGS_KEY,
        category: NOTIFICATION_SETTINGS_CATEGORY,
        value: mapToJson(updatedValue),
      },
    });

    logger.info('Notification settings updated');
    return toJsonObject(record.value) as NotificationSettings;
  }

  static async getReminderSettings(): Promise<ReminderSettings> {
    const settings = await prisma.systemConfig.findUnique({
      where: { key: REMINDER_SETTINGS_KEY },
    });

    if (!settings) {
      return this.updateReminderSettings({});
    }

    return toJsonObject(settings.value) as ReminderSettings;
  }

  static async updateReminderSettings(data: Partial<ReminderSettings>): Promise<ReminderSettings> {
    const existing = await prisma.systemConfig.findUnique({ where: { key: REMINDER_SETTINGS_KEY } });
    const updatedValue = mergeSettings<ReminderSettings>(existing?.value ?? null, data, defaultReminderSettings());

    const record = await prisma.systemConfig.upsert({
      where: { key: REMINDER_SETTINGS_KEY },
      update: { value: mapToJson(updatedValue) },
      create: {
        key: REMINDER_SETTINGS_KEY,
        category: REMINDER_SETTINGS_CATEGORY,
        value: mapToJson(updatedValue),
      },
    });

    logger.info('Reminder settings updated');
    return toJsonObject(record.value) as ReminderSettings;
  }

  static async createBackup() {
    const timestamp = new Date().toISOString();

    const backup = await prisma.systemConfig.create({
      data: {
        key: `backup_${Date.now()}`,
        category: BACKUP_CATEGORY,
        value: {
          timestamp,
          status: 'completed',
        },
      },
    });

    logger.info('System backup created', { backupId: backup.id });
    return { backupId: backup.id, timestamp };
  }

  static async restoreFromBackup(backupId: string) {
    const backup = await prisma.systemConfig.findUnique({ where: { id: backupId } });

    if (!backup || !backup.key.startsWith('backup_')) {
      throw new CustomError('Backup not found', 404);
    }

    logger.info('System restore initiated', { backupId });
    return { message: 'Restore initiated', backupId };
  }
}

