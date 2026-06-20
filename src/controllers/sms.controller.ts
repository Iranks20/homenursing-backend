import { Request, Response, NextFunction } from 'express';
import {
  SmsService,
  SmsCategory,
  SmsRecipientInput,
  DirectoryRecipientType,
} from '../services/sms.service';
import { AppointmentSmsReminderService } from '../services/appointmentSmsReminder.service';
import { BirthdaySmsService } from '../services/birthdaySms.service';
import { SmsAutomationService, SmsAutomationSettings } from '../services/smsAutomation.service';
import { parseAppointmentReminderTiming } from '../utils/appointmentReminderSchedule';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const SMS_CATEGORIES: SmsCategory[] = [
  'appointment',
  'prescription',
  'birthday',
  'payment',
  'general',
];

const parseCategory = (value: unknown): SmsCategory | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase() as SmsCategory;
  return SMS_CATEGORIES.includes(normalized) ? normalized : undefined;
};

const parseRecipients = (input: unknown): SmsRecipientInput[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (typeof entry === 'string') {
        return { phone: entry } as SmsRecipientInput;
      }
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const phone = typeof obj.phone === 'string' ? obj.phone : undefined;
        if (!phone) return null;
        const recipient: SmsRecipientInput = { phone };
        if (typeof obj.patientId === 'string') recipient.patientId = obj.patientId;
        if (typeof obj.name === 'string') recipient.name = obj.name;
        return recipient;
      }
      return null;
    })
    .filter((entry): entry is SmsRecipientInput => entry !== null);
};

const DIRECTORY_TYPES: DirectoryRecipientType[] = [
  'patient',
  'nurse',
  'specialist',
  'therapist',
  'receptionist',
  'biller',
  'admin',
  'lab_attendant',
];

const parseDirectoryType = (value: unknown): DirectoryRecipientType | 'all' | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  if (normalized === 'all') return 'all';
  return (DIRECTORY_TYPES as string[]).includes(normalized)
    ? (normalized as DirectoryRecipientType)
    : undefined;
};

const parsePatientIds = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  return input.filter((value): value is string => typeof value === 'string' && value.length > 0);
};

export class SmsController {
  static async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        throw new CustomError('Message is required', 400);
      }

      const recipients = parseRecipients(body.recipients);
      const patientIds = parsePatientIds(body.patientIds);
      if (!recipients.length && !patientIds.length) {
        throw new CustomError('At least one recipient is required', 400);
      }

      const result = await SmsService.send({
        message,
        category: parseCategory(body.category) ?? 'general',
        recipients,
        patientIds,
        ...(req.user?.userId ? { sentBy: req.user.userId } : {}),
        ...(req.user?.email ? { sentByName: req.user.email } : {}),
      });

      res.status(201).json({ success: true, message: 'SMS dispatched', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 20);
      const category = parseCategory(req.query.category);
      const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
      const params: Parameters<typeof SmsService.list>[0] = { page, limit };
      if (category) params.category = category;
      if (patientId) params.patientId = patientId;
      const result = await SmsService.list(params);

      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) throw new CustomError('Message ID is required', 400);
      const record = await SmsService.getById(id);
      if (!record) throw new CustomError('SMS not found', 404);
      res.status(200).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  static async listTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await SmsService.listTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  static async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const category = parseCategory(body.category) ?? 'general';
      if (!name || !message) {
        throw new CustomError('Template name and message are required', 400);
      }

      const template = await SmsService.createTemplate({ name, category, message });
      res.status(201).json({ success: true, message: 'Template created', data: template });
    } catch (error) {
      next(error);
    }
  }

  static async directory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 20);
      const type = parseDirectoryType(req.query.type) ?? 'all';
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const params: Parameters<typeof SmsService.getDirectory>[0] = { page, limit, type };
      if (search) params.search = search;

      const result = await SmsService.getDirectory(params);
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getAutomationSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await SmsAutomationService.getSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async updateAutomationSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const patch: Partial<SmsAutomationSettings> = {};
      if (body.appointmentReminderTiming !== undefined) {
        patch.appointmentReminderTiming = parseAppointmentReminderTiming(body.appointmentReminderTiming);
      }
      if (body.birthdaySmsEnabled !== undefined) {
        patch.birthdaySmsEnabled = Boolean(body.birthdaySmsEnabled);
      }
      if (body.birthdaySendHourUtc !== undefined) {
        patch.birthdaySendHourUtc = Number(body.birthdaySendHourUtc);
      }
      if (body.midDayReminderHourUtc !== undefined) {
        patch.midDayReminderHourUtc = Number(body.midDayReminderHourUtc);
      }
      const settings = await SmsAutomationService.updateSettings(patch);
      res.status(200).json({ success: true, message: 'SMS automation settings updated', data: settings });
    } catch (error) {
      next(error);
    }
  }

  static async listAppointmentReminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 20);
      const viewParam = typeof req.query.view === 'string' ? req.query.view.toLowerCase() : 'upcoming';
      const view = viewParam === 'delivered' ? 'delivered' : 'upcoming';
      const result = await AppointmentSmsReminderService.list({ view, page, limit });
      res.status(200).json({
        success: true,
        data: result.reminders,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listBirthdayDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 20);
      const viewParam = typeof req.query.view === 'string' ? req.query.view.toLowerCase() : 'upcoming';
      const view = viewParam === 'delivered' ? 'delivered' : 'upcoming';
      const result = await BirthdaySmsService.list({ view, page, limit });
      res.status(200).json({
        success: true,
        data: result.deliveries,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) throw new CustomError('Template ID is required', 400);
      await SmsService.deleteTemplate(id);
      res.status(200).json({ success: true, message: 'Template removed' });
    } catch (error) {
      next(error);
    }
  }
}
