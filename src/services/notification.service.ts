import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationCategory,
  PatientBillingFrequency,
  Prisma,
} from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  appointmentReminders: boolean;
  paymentReminders: boolean;
  [key: string]: unknown;
}

export interface CreateNotificationData {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  phoneNotification?: boolean;
  smsSent?: boolean;
  callMade?: boolean;
}

const DEFAULT_PRIORITY = NotificationPriority.LOW;
const DEFAULT_CATEGORY = NotificationCategory.GENERAL;
const PREFERENCES_CATEGORY = 'notifications_preferences';

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const getPreferenceKey = (userId: string): string => `notification_prefs_${userId}`;

const defaultPreferences = (): NotificationPreferences => ({
  email: true,
  sms: false,
  push: true,
  appointmentReminders: true,
  paymentReminders: true,
});

export class NotificationService {
  static async createNotification(data: CreateNotificationData): Promise<Notification> {
    const createData: Prisma.NotificationUncheckedCreateInput = {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      priority: data.priority ?? DEFAULT_PRIORITY,
      category: data.category ?? DEFAULT_CATEGORY,
      phoneNotification: data.phoneNotification ?? false,
      smsSent: data.smsSent ?? false,
      callMade: data.callMade ?? false,
    };

    const notification = await prisma.notification.create({ data: createData });
    logger.info('Notification created', { notificationId: notification.id });
    return notification;
  }

  static async getNotificationById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({ where: { id } });
  }

  static async getNotifications(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  static async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const key = getPreferenceKey(userId);
    const prefs = await prisma.systemConfig.findUnique({ where: { key } });

    if (!prefs) {
      return this.updateNotificationPreferences(userId, defaultPreferences());
    }

    return toJsonObject(prefs.value) as NotificationPreferences;
  }

  static async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const key = getPreferenceKey(userId);
    const existing = await prisma.systemConfig.findUnique({ where: { key } });

    const merged = Object.assign({}, defaultPreferences(), toJsonObject(existing?.value ?? null), preferences);

    const record = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: merged as Prisma.InputJsonObject },
      create: {
        key,
        category: PREFERENCES_CATEGORY,
        value: merged as Prisma.InputJsonObject,
      },
    });

    return toJsonObject(record.value) as NotificationPreferences;
  }

  static async sendTestNotification(userId: string) {
    return this.createNotification({
      userId,
      title: 'Test Notification',
      message: 'This is a test notification',
      type: NotificationType.INFO,
      priority: NotificationPriority.LOW,
      category: NotificationCategory.SYSTEM,
    });
  }

  static async getNotificationHistory(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  static async bulkMarkAsRead(userId: string, notificationIds: string[]) {
    if (notificationIds.length === 0) {
      throw new CustomError('No notifications provided', 400);
    }

    await prisma.notification.updateMany({
      where: { userId, id: { in: notificationIds }, isRead: false },
      data: { isRead: true },
    });
  }

  static async bulkDelete(userId: string, notificationIds: string[]) {
    if (notificationIds.length === 0) {
      throw new CustomError('No notifications provided', 400);
    }

    await prisma.notification.deleteMany({ where: { userId, id: { in: notificationIds } } });
  }

  static async deleteNotification(id: string): Promise<void> {
    await prisma.notification.delete({ where: { id } });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  static async notifyBillingTeamPatientReady(params: {
    patientId: string;
    patientName: string;
    contractStartDate: Date;
    billingFrequency: PatientBillingFrequency | null;
    agreedServiceAmount: number | null;
  }): Promise<void> {
    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['ADMIN', 'BILLER'] } },
      select: { id: true },
    });
    if (recipients.length === 0) {
      return;
    }

    const startLabel = params.contractStartDate.toISOString().slice(0, 10);
    const freqLabel =
      params.billingFrequency === 'DAILY'
        ? 'per day'
        : params.billingFrequency === 'MONTHLY'
          ? 'per month'
          : 'not set';
    const amountLabel =
      params.agreedServiceAmount != null
        ? `${params.agreedServiceAmount.toLocaleString('en-UG')} UGX`
        : 'not set';

    const title = 'Patient ready for invoicing';
    const message = `${params.patientName} has been registered. Contract starts ${startLabel}. Agreed charge: ${amountLabel} ${freqLabel}. Please generate billing for this client.`;

    await Promise.all(
      recipients.map((user) =>
        this.createNotification({
          userId: user.id,
          title,
          message,
          type: NotificationType.INFO,
          priority: NotificationPriority.HIGH,
          category: NotificationCategory.BILLING,
        })
      )
    );
  }
}

