import { Request, Response, NextFunction } from 'express';
import { NotificationPriority, NotificationCategory, NotificationType } from '@prisma/client';
import { NotificationService, CreateNotificationData } from '../services/notification.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) throw new CustomError('Unauthorized', 401);
  return userId;
};

const requireId = (id: string | undefined): string => {
  if (!id) throw new CustomError('Notification ID is required', 400);
  return id;
};

const parseNotificationIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    throw new CustomError('notificationIds must be an array', 400);
  }
  return value.map(id => {
    if (typeof id !== 'string' || id.length === 0) {
      throw new CustomError('notificationIds must contain strings', 400);
    }
    return id;
  });
};

const parseEnumValue = <T>(enumObj: Record<string, T>, value: string | undefined, name: string, required: boolean): T | undefined => {
  if (!value) {
    if (required) throw new CustomError(`${name} is required`, 400);
    return undefined;
  }

  const normalized = value.toUpperCase();
  if (normalized in enumObj) {
    return enumObj[normalized as keyof typeof enumObj];
  }
  throw new CustomError(`${name} is invalid`, 400);
};

const parseEnumValueOrDefault = <T>(
  enumObj: Record<string, T>,
  value: string | undefined,
  fallback: T
): T => {
  if (!value) return fallback;
  const normalized = value.toUpperCase();
  if (normalized in enumObj) {
    const matched = enumObj[normalized as keyof typeof enumObj];
    return matched ?? fallback;
  }
  return fallback;
};

const parseCreatePayload = (body: unknown, userId: string): CreateNotificationData => {
  const data = body as Record<string, unknown>;
  const getString = (key: string, required = true): string | undefined => {
    const value = data[key];
    if (value === undefined || value === null) {
      if (required) throw new CustomError(`${key} is required`, 400);
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new CustomError(`${key} must be a string`, 400);
    }
    return value;
  };

  const title = getString('title');
  const message = getString('message');

  const type = parseEnumValue(NotificationType, getString('type'), 'type', true)!;
  const priority = parseEnumValueOrDefault(
    NotificationPriority,
    getString('priority', false),
    NotificationPriority.MEDIUM
  );
  const category = parseEnumValueOrDefault(
    NotificationCategory,
    getString('category', false),
    NotificationCategory.GENERAL
  );

  const phoneNotification = data.phoneNotification;
  const smsSent = data.smsSent;
  const callMade = data.callMade;

  const payload: CreateNotificationData = {
    userId,
    title: title!,
    message: message!,
    type,
  };

  payload.priority = priority;
  payload.category = category;
  if (phoneNotification !== undefined) payload.phoneNotification = Boolean(phoneNotification);
  if (smsSent !== undefined) payload.smsSent = Boolean(smsSent);
  if (callMade !== undefined) payload.callMade = Boolean(callMade);

  return payload;
};

export class NotificationController {
  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await NotificationService.getNotifications(userId, page, limit);
      res.status(200).json({ success: true, data: result.notifications, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getNotificationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = requireId(req.params.id);
      const notification = await NotificationService.getNotificationById(notificationId);
      if (!notification) throw new CustomError('Notification not found', 404);
      res.status(200).json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = requireId(req.params.id);
      const notification = await NotificationService.markAsRead(notificationId);
      res.status(200).json({ success: true, message: 'Notification marked as read', data: notification });
    } catch (error) {
      next(error);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      await NotificationService.markAllAsRead(userId);
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notificationId = requireId(req.params.id);
      await NotificationService.deleteNotification(notificationId);
      res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const count = await NotificationService.getUnreadCount(userId);
      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }

  static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const preferences = await NotificationService.getNotificationPreferences(userId);
      res.status(200).json({ success: true, data: preferences });
    } catch (error) {
      next(error);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const preferences = await NotificationService.updateNotificationPreferences(userId, req.body);
      res.status(200).json({ success: true, message: 'Preferences updated', data: preferences });
    } catch (error) {
      next(error);
    }
  }

  static async sendTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const notification = await NotificationService.sendTestNotification(userId);
      res.status(200).json({ success: true, message: 'Test notification sent', data: notification });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 50);
      const result = await NotificationService.getNotificationHistory(userId, page, limit);
      res.status(200).json({ success: true, data: result.notifications, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async bulkMarkAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const notificationIds = parseNotificationIds(req.body?.notificationIds);
      await NotificationService.bulkMarkAsRead(userId, notificationIds);
      res.status(200).json({ success: true, message: 'Notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

  static async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const notificationIds = parseNotificationIds(req.body?.notificationIds);
      await NotificationService.bulkDelete(userId, notificationIds);
      res.status(200).json({ success: true, message: 'Notifications deleted' });
    } catch (error) {
      next(error);
    }
  }

  static async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const payload = parseCreatePayload(req.body, userId);
      const notification = await NotificationService.createNotification(payload);
      res.status(201).json({ success: true, message: 'Notification created', data: notification });
    } catch (error) {
      next(error);
    }
  }
}

