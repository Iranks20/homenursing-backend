import { Request, Response, NextFunction } from 'express';
import {
  AppointmentService,
  AppointmentFilters,
  CreateAppointmentData,
  GetAvailableSlotsFilters,
} from '../services/appointment.service';
import {
  validateBody,
  validateQuery,
  createAppointmentSchema,
  updateAppointmentSchema,
  searchAppointmentsSchema,
  rescheduleAppointmentSchema,
  cancelAppointmentSchema,
} from '../validators/appointment.validator';
import { CustomError } from '../middleware/error.middleware';
import { AppointmentStatus } from '@prisma/client';
import prisma from '../config/database';
import { normalizePhoneNumber } from '../services/egoSms.service';
import { AppointmentSmsReminderService } from '../services/appointmentSmsReminder.service';
import { parseAppointmentReminderTiming } from '../utils/appointmentReminderSchedule';
import type { AppointmentReminderTiming } from '../utils/appointmentReminderSchedule';
import { logger } from '../utils/logger';

type CreateAppointmentBody = CreateAppointmentData & {
  patientPhone?: string;
  notifyPatient?: boolean;
  reminderTiming?: AppointmentReminderTiming;
};

type ReschedulePayload = {
  date: Date;
  time: string;
  reason?: string;
};

type CancelPayload = {
  reason?: string;
};

type PaginationQuery = {
  page?: number;
  limit?: number;
};

const requireParam = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new CustomError(`${name} is required`, 400);
  }
  return value;
};

const ensureValidDate = (value: Date): Date => {
  if (Number.isNaN(value.getTime())) {
    throw new CustomError('Invalid date value', 400);
  }
  return value;
};

const parsePagination = (query: PaginationQuery): { page: number; limit: number } => {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 10;
  return { page, limit };
};

export class AppointmentController {
  static async getAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<AppointmentFilters>(searchAppointmentsSchema, req.query);
      const normalizedFilters: AppointmentFilters = {
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.nurseId ? { nurseId: filters.nurseId } : {}),
        ...(filters.specialistId ? { specialistId: filters.specialistId } : {}),
        ...(filters.therapistId ? { therapistId: filters.therapistId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.startDate ? { startDate: ensureValidDate(new Date(filters.startDate)) } : {}),
        ...(filters.endDate ? { endDate: ensureValidDate(new Date(filters.endDate)) } : {}),
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
      };

      const result = await AppointmentService.getAppointments(normalizedFilters);

      res.status(200).json({
        success: true,
        data: result.appointments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAppointmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const appointment = await AppointmentService.getAppointmentById(id);

      if (!appointment) {
        throw new CustomError('Appointment not found', 404);
      }

      res.status(200).json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  static async createAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = validateBody<CreateAppointmentBody>(createAppointmentSchema, req.body);
      const { patientPhone, notifyPatient, reminderTiming, ...data } = body;

      const overrideRaw = typeof patientPhone === 'string' ? patientPhone.trim() : '';
      const normalizedOverride = overrideRaw ? normalizePhoneNumber(overrideRaw) : '';
      if (normalizedOverride && data.patientId) {
        const existing = await prisma.patient.findUnique({
          where: { id: data.patientId },
          select: { phone: true },
        });
        if (existing && normalizePhoneNumber(existing.phone ?? '') !== normalizedOverride) {
          await prisma.patient.update({
            where: { id: data.patientId },
            data: { phone: overrideRaw },
          });
        }
      }

      const appointment = await AppointmentService.createAppointment({
        ...data,
        date: ensureValidDate(new Date(data.date)),
      });

      const shouldNotify = notifyPatient !== false;
      const reminderOptions: Parameters<typeof AppointmentSmsReminderService.syncForAppointment>[1] = {
        enabled: shouldNotify,
        patientPhoneOverride: overrideRaw || appointment.patient?.phone || '',
      };
      if (reminderTiming) {
        reminderOptions.reminderTiming = parseAppointmentReminderTiming(reminderTiming);
      }
      AppointmentSmsReminderService.syncForAppointment(appointment, reminderOptions).catch((err) => {
        logger.warn('Appointment SMS reminder scheduling failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const body = validateBody<Partial<CreateAppointmentBody>>(updateAppointmentSchema, req.body);
      const { patientPhone, notifyPatient, reminderTiming, ...data } = body;

      const overrideRaw = typeof patientPhone === 'string' ? patientPhone.trim() : '';
      const targetPatientId = data.patientId ?? (await prisma.appointment.findUnique({ where: { id }, select: { patientId: true } }))?.patientId;
      if (overrideRaw && targetPatientId) {
        const existing = await prisma.patient.findUnique({
          where: { id: targetPatientId },
          select: { phone: true },
        });
        if (existing && normalizePhoneNumber(existing.phone ?? '') !== normalizePhoneNumber(overrideRaw)) {
          await prisma.patient.update({ where: { id: targetPatientId }, data: { phone: overrideRaw } });
        }
      }

      const updates: Partial<CreateAppointmentData> = {};
      if (data.patientId !== undefined) updates.patientId = data.patientId;
      if (data.nurseId !== undefined) updates.nurseId = data.nurseId;
      if (data.specialistId !== undefined) updates.specialistId = data.specialistId;
      if (data.therapistId !== undefined) {
        updates.therapistId = data.therapistId ?? null;
      }
      if (data.serviceId !== undefined) updates.serviceId = data.serviceId;
      if (data.date !== undefined) updates.date = ensureValidDate(new Date(data.date));
      if (data.time !== undefined) updates.time = data.time;
      if (data.duration !== undefined) updates.duration = data.duration;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.status !== undefined) {
        updates.status = data.status as AppointmentStatus;
      }

      const appointment = await AppointmentService.updateAppointment(id, updates);

      const notifyEnabled = notifyPatient !== false;
      const reminderOptions: Parameters<typeof AppointmentSmsReminderService.syncForAppointment>[1] = {
        enabled: notifyEnabled,
        patientPhoneOverride: overrideRaw || appointment.patient?.phone || '',
      };
      if (reminderTiming) {
        reminderOptions.reminderTiming = parseAppointmentReminderTiming(reminderTiming);
      }
      AppointmentSmsReminderService.syncForAppointment(appointment, reminderOptions).catch((err) => {
        logger.warn('Appointment SMS reminder sync failed after update', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      res.status(200).json({
        success: true,
        message: 'Appointment updated successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const { reason } = validateBody<CancelPayload>(cancelAppointmentSchema, req.body);
      const appointment = await AppointmentService.cancelAppointment(id, reason);

      AppointmentSmsReminderService.cancelForAppointment(id).catch((err) => {
        logger.warn('Appointment SMS reminder cancel failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      res.status(200).json({
        success: true,
        message: 'Appointment cancelled successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async rescheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const { date, time, reason } = validateBody<ReschedulePayload>(rescheduleAppointmentSchema, req.body);
      const appointment = await AppointmentService.rescheduleAppointment(id, ensureValidDate(new Date(date)), time, reason);

      AppointmentSmsReminderService.syncForAppointment(appointment, {
        enabled: true,
        patientPhoneOverride: appointment.patient?.phone || '',
      }).catch((err) => {
        logger.warn('Appointment SMS reminder sync failed after reschedule', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      res.status(200).json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const appointment = await AppointmentService.completeAppointment(id);

      res.status(200).json({
        success: true,
        message: 'Appointment completed successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async startAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const appointment = await AppointmentService.startAppointment(id);

      res.status(200).json({
        success: true,
        message: 'Appointment started successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParam(req.params.patientId, 'Patient ID');
      const { page, limit } = parsePagination(req.query as PaginationQuery);
      const result = await AppointmentService.getPatientAppointments(patientId, page, limit);

      res.status(200).json({ success: true, data: result.appointments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getNurseAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nurseId = requireParam(req.params.nurseId, 'Nurse ID');
      const { page, limit } = parsePagination(req.query as PaginationQuery);
      const result = await AppointmentService.getNurseAppointments(nurseId, page, limit);

      res.status(200).json({ success: true, data: result.appointments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getSpecialistAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const specialistId = requireParam(req.params.specialistId, 'Specialist ID');
      const { page, limit } = parsePagination(req.query as PaginationQuery);
      const result = await AppointmentService.getSpecialistAppointments(specialistId, page, limit);

      res.status(200).json({ success: true, data: result.appointments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<CreateAppointmentData>(createAppointmentSchema, req.body);
      const conflicts = await AppointmentService.checkConflicts({
        ...data,
        date: ensureValidDate(new Date(data.date)),
      });

      res.status(200).json({
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAvailableSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateParam = requireParam(req.query.date as string | undefined, 'date');
      const date = ensureValidDate(new Date(dateParam));
      const nurseId = req.query.nurseId as string | undefined;
      const specialistId = req.query.specialistId as string | undefined;
      const parsedDuration = req.query.duration ? Number.parseInt(req.query.duration as string, 10) : undefined;

      const slotFilters: GetAvailableSlotsFilters = { date };
      if (nurseId) {
        slotFilters.nurseId = nurseId;
      }
      if (specialistId) {
        slotFilters.specialistId = specialistId;
      }
      if (parsedDuration !== undefined && !Number.isNaN(parsedDuration)) {
        slotFilters.duration = parsedDuration;
      }

      const slots = await AppointmentService.getAvailableSlots(slotFilters);

      res.status(200).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  static async getCalendarView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireParam(req.params.userId, 'User ID');
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;

      const startDate = ensureValidDate(startDateParam ? new Date(startDateParam) : new Date());
      const endDate = ensureValidDate(endDateParam ? new Date(endDateParam) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      const result = await AppointmentService.getCalendarView(userId, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async markAsNoShow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const appointment = await AppointmentService.markAsNoShow(id);

      res.status(200).json({
        success: true,
        message: 'Appointment marked as no-show',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParam(req.params.id, 'Appointment ID');
      const notes = requireParam(req.body?.notes, 'Notes');
      const appointment = await AppointmentService.addNotes(id, notes);

      res.status(200).json({
        success: true,
        message: 'Notes added successfully',
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }
}

