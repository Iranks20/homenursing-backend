import { Request, Response, NextFunction } from 'express';
import { SettingsService, SystemSettings, NotificationSettings, ReminderSettings } from '../services/settings.service';
import { CustomError } from '../middleware/error.middleware';

const parseBody = <T>(body: unknown): T => body as T;

export class SettingsController {
  static async getSystemSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingsService.getSystemSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async updateSystemSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseBody<Partial<SystemSettings>>(req.body);
      const settings = await SettingsService.updateSystemSettings(payload);
      res.status(200).json({ success: true, message: 'System settings updated', data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async getNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingsService.getNotificationSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async updateNotificationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseBody<Partial<NotificationSettings>>(req.body);
      const settings = await SettingsService.updateNotificationSettings(payload);
      res.status(200).json({ success: true, message: 'Notification settings updated', data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async getReminderSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SettingsService.getReminderSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async updateReminderSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseBody<Partial<ReminderSettings>>(req.body);
      const settings = await SettingsService.updateReminderSettings(payload);
      res.status(200).json({ success: true, message: 'Reminder settings updated', data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SettingsService.createBackup();
      res.status(201).json({ success: true, message: 'Backup created successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async restoreBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backupId } = parseBody<{ backupId?: string }>(req.body);
      if (!backupId) throw new CustomError('Backup ID is required', 400);
      const result = await SettingsService.restoreFromBackup(backupId);
      res.status(200).json({ success: true, message: 'Restore initiated', data: result });
    } catch (error) {
      next(error);
    }
  }
}

