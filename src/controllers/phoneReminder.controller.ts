import { Request, Response, NextFunction } from 'express';
import {
  PhoneReminderService,
  CreatePhoneReminderData,
  UpdatePhoneReminderData,
  PhoneReminderStatus,
} from '../services/phoneReminder.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseDate = (value: unknown, fieldName: string): Date => {
  if (!value) {
    throw new CustomError(`${fieldName} is required`, 400);
  }
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${fieldName} is invalid`, 400);
  }
  return date;
};

const parseCreatePayload = (body: unknown): CreatePhoneReminderData => {
  const data = body as Record<string, unknown>;
  const patientId = data.patientId as string | undefined;
  const message = data.message as string | undefined;
  
  // Accept both scheduledAt and scheduledTime (frontend sends scheduledTime)
  const scheduledAtValue = data.scheduledAt ?? data.scheduledTime;
  const scheduledAt = parseDate(scheduledAtValue, 'scheduledAt');
  
  // Accept both phoneNumber and patientPhone (frontend sends patientPhone)
  const phoneNumber = (data.phoneNumber ?? data.patientPhone) as string | undefined;
  
  // Accept both reminderType and type (frontend sends type)
  const reminderType = (data.reminderType ?? data.type) as string | undefined;

  if (!patientId) throw new CustomError('patientId is required', 400);
  if (!message) throw new CustomError('message is required', 400);
  if (!phoneNumber) throw new CustomError('phoneNumber is required', 400);
  if (!reminderType) throw new CustomError('reminderType is required', 400);

  const payload: CreatePhoneReminderData = {
    patientId,
    message,
    scheduledAt,
    phoneNumber,
    reminderType,
  };

  if (data.appointmentId !== undefined) {
    payload.appointmentId = data.appointmentId as string;
  }

  // Additional fields from frontend
  if (data.title !== undefined) payload.title = data.title as string;
  if (data.method !== undefined) payload.method = data.method as 'sms' | 'call' | 'both';
  if (data.priority !== undefined) payload.priority = data.priority as 'low' | 'medium' | 'high' | 'urgent';
  if (data.maxAttempts !== undefined) payload.maxAttempts = parseNumber(data.maxAttempts, 3);
  if (data.patientName !== undefined) payload.patientName = data.patientName as string;

  return payload;
};

const parseUpdatePayload = (body: unknown): UpdatePhoneReminderData => {
  const data = body as Record<string, unknown>;
  const payload: UpdatePhoneReminderData = {};

  if (data.appointmentId !== undefined) payload.appointmentId = data.appointmentId as string;
  if (data.message !== undefined) payload.message = data.message as string;
  
  // Accept both scheduledAt and scheduledTime (frontend sends scheduledTime)
  const scheduledAtValue = data.scheduledAt ?? data.scheduledTime;
  if (scheduledAtValue !== undefined) payload.scheduledAt = parseDate(scheduledAtValue, 'scheduledAt');
  
  // Accept both phoneNumber and patientPhone (frontend sends patientPhone)
  const phoneNumber = data.phoneNumber ?? data.patientPhone;
  if (phoneNumber !== undefined) payload.phoneNumber = phoneNumber as string;
  
  // Accept both reminderType and type (frontend sends type)
  const reminderType = data.reminderType ?? data.type;
  if (reminderType !== undefined) payload.reminderType = reminderType as string;
  
  if (data.status !== undefined) payload.status = data.status as 'scheduled' | 'sent' | 'cancelled';

  // Additional fields from frontend
  if (data.title !== undefined) payload.title = data.title as string;
  if (data.method !== undefined) payload.method = data.method as 'sms' | 'call' | 'both';
  if (data.priority !== undefined) payload.priority = data.priority as 'low' | 'medium' | 'high' | 'urgent';
  if (data.maxAttempts !== undefined) payload.maxAttempts = parseNumber(data.maxAttempts, 3);
  if (data.patientName !== undefined) payload.patientName = data.patientName as string;

  return payload;
};

const requireId = (id: string | undefined): string => {
  if (!id) {
    throw new CustomError('Reminder ID is required', 400);
  }
  return id;
};

export class PhoneReminderController {
  static async getReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await PhoneReminderService.getReminders(patientId, page, limit);
      res.status(200).json({ success: true, data: result.reminders, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getReminderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminderId = requireId(req.params.id);
      const reminder = await PhoneReminderService.getReminderById(reminderId);
      if (!reminder) throw new CustomError('Reminder not found', 404);
      res.status(200).json({ success: true, data: reminder });
    } catch (error) {
      next(error);
    }
  }

  static async createReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreatePayload(req.body);
      const reminder = await PhoneReminderService.createReminder(payload);
      res.status(201).json({ success: true, message: 'Reminder created successfully', data: reminder });
    } catch (error) {
      next(error);
    }
  }

  static async updateReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminderId = requireId(req.params.id);
      const payload = parseUpdatePayload(req.body);
      const reminder = await PhoneReminderService.updateReminder(reminderId, payload);
      res.status(200).json({ success: true, message: 'Reminder updated successfully', data: reminder });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminderId = requireId(req.params.id);
      await PhoneReminderService.deleteReminder(reminderId);
      res.status(200).json({ success: true, message: 'Reminder deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async sendReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminderId = requireId(req.params.id);
      const result = await PhoneReminderService.sendReminder(reminderId);
      res.status(200).json({ success: true, message: 'Reminder sent successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async cancelReminder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reminderId = requireId(req.params.id);
      const result = await PhoneReminderService.cancelReminder(reminderId);
      res.status(200).json({ success: true, message: 'Reminder cancelled successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await PhoneReminderService.getTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }
}

