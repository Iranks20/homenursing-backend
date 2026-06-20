import { Appointment, AppointmentStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

const appointmentInclude = {
  patient: true,
  nurse: true,
  specialist: true,
  therapist: true,
  service: true,
} as const;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

type DateRangeFilter = { startDate?: Date; endDate?: Date };

const SPECIALIST_ROLES: UserRole[] = [
  UserRole.SPECIALIST,
];

const EXCLUDED_STATUSES_FOR_CONFLICTS: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
];

const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

const normalizeDate = (input: Date): Date => {
  const normalized = new Date(input);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const combineDateAndTime = (date: Date, time: string): Date => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number.parseInt(hoursStr ?? '0', 10);
  const minutes = Number.parseInt(minutesStr ?? '0', 10);
  const result = normalizeDate(date);
  result.setUTCHours(
    Number.isNaN(hours) ? 0 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0
  );
  return result;
};

const buildDateFilter = (startDate?: Date, endDate?: Date): Prisma.DateTimeFilter | undefined => {
  if (!startDate && !endDate) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};

  if (startDate) {
    filter.gte = normalizeDate(startDate);
  }

  if (endDate) {
    const normalizedEnd = normalizeDate(endDate);
    normalizedEnd.setUTCHours(23, 59, 59, 999);
    filter.lte = normalizedEnd;
  }

  return filter;
};

const buildParticipantFilters = (data: {
  nurseId?: string | null;
  specialistId?: string | null;
  therapistId?: string | null;
}): Prisma.AppointmentWhereInput[] => {
  const filters: Prisma.AppointmentWhereInput[] = [];

  if (data.nurseId) {
    filters.push({ nurseId: data.nurseId });
  }

  if (data.specialistId) {
    filters.push({ specialistId: data.specialistId });
  }

  if (data.therapistId) {
    filters.push({ therapistId: data.therapistId });
  }

  return filters;
};

export interface CreateAppointmentData {
  patientId: string;
  nurseId?: string;
  specialistId?: string;
  therapistId?: string | null;
  serviceId: string;
  date: Date;
  time: string;
  duration: number;
  notes?: string;
  status?: AppointmentStatus;
}

export interface AppointmentFilters {
  patientId?: string;
  nurseId?: string;
  specialistId?: string;
  therapistId?: string;
  status?: AppointmentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface GetAvailableSlotsFilters {
  date: Date;
  nurseId?: string;
  specialistId?: string;
  therapistId?: string;
  duration?: number;
}

export class AppointmentService {
  static async createAppointment(data: CreateAppointmentData): Promise<AppointmentWithRelations> {
    const normalizedDate = normalizeDate(data.date);
    const conflicts = await this.checkConflicts({ ...data, date: normalizedDate });

    if (conflicts.length > 0) {
      throw new CustomError('Appointment conflicts with existing appointments', 409);
    }

    const appointmentData: Prisma.AppointmentUncheckedCreateInput = {
      patientId: data.patientId,
      serviceId: data.serviceId,
      date: normalizedDate,
      time: data.time,
      duration: data.duration,
    };

    if (data.nurseId) {
      appointmentData.nurseId = data.nurseId;
    }

    if (data.specialistId) {
      appointmentData.specialistId = data.specialistId;
    }

    if (data.therapistId) {
      appointmentData.therapistId = data.therapistId;
    }

    if (data.notes) {
      appointmentData.notes = data.notes;
    }

    const appointment = await prisma.appointment.create({
      data: appointmentData,
      include: appointmentInclude,
    });

    logger.info('Appointment created', { appointmentId: appointment.id });
    return appointment;
  }

  static async checkConflicts(data: CreateAppointmentData): Promise<Appointment[]> {
    const participants = buildParticipantFilters(data);
    if (participants.length === 0) {
      return [];
    }

    const appointmentDate = normalizeDate(data.date);
    const where: Prisma.AppointmentWhereInput = {
      date: appointmentDate,
      status: { notIn: EXCLUDED_STATUSES_FOR_CONFLICTS },
      OR: participants,
    };

    const existingAppointments = await prisma.appointment.findMany({ where });

    const targetStart = combineDateAndTime(appointmentDate, data.time);
    const targetEnd = new Date(targetStart.getTime() + data.duration * 60000);

    return existingAppointments.filter((appointment) => {
      const existingStart = combineDateAndTime(appointment.date, appointment.time);
      const existingEnd = new Date(existingStart.getTime() + appointment.duration * 60000);
      return existingEnd > targetStart && existingStart < targetEnd;
    });
  }

  static async getAppointmentById(id: string): Promise<AppointmentWithRelations | null> {
    return prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
  }

  static async getAppointments(filters: AppointmentFilters = {}): Promise<{
    appointments: AppointmentWithRelations[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      patientId,
      nurseId,
      specialistId,
      therapistId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    // Ensure page and limit are numbers (defensive programming)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : Number(page) || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : Number(limit) || 10;

    const where: Prisma.AppointmentWhereInput = {};
    
    if (patientId) where.patientId = patientId;
    if (nurseId) where.nurseId = nurseId;
    if (specialistId) where.specialistId = specialistId;
    if (therapistId) where.therapistId = therapistId;
    if (status) where.status = status;

    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) {
      where.date = dateFilter;
    }

    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ]);

    return {
      appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  static async updateAppointment(id: string, data: Partial<CreateAppointmentData>): Promise<AppointmentWithRelations> {
    const updates: Prisma.AppointmentUncheckedUpdateInput = {};

    if (data.patientId !== undefined) updates.patientId = data.patientId;
    if (data.nurseId !== undefined) updates.nurseId = data.nurseId;
    if (data.specialistId !== undefined) updates.specialistId = data.specialistId;
    if (data.therapistId !== undefined) {
      updates.therapistId = data.therapistId;
    }
    if (data.serviceId !== undefined) updates.serviceId = data.serviceId;
    if (data.date !== undefined) updates.date = normalizeDate(data.date);
    if (data.time !== undefined) updates.time = data.time;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.status !== undefined) updates.status = data.status;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updates,
      include: appointmentInclude,
    });

    logger.info('Appointment updated', { appointmentId: id });
    return appointment;
  }

  static async cancelAppointment(id: string, reason?: string): Promise<AppointmentWithRelations> {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Appointment not found', 404);
    }

    const updates: Prisma.AppointmentUncheckedUpdateInput = {
      status: AppointmentStatus.CANCELLED,
    };

    if (reason) {
      updates.notes = existing.notes ? `${existing.notes}\n${reason}` : reason;
    }

    return prisma.appointment.update({
      where: { id },
      data: updates,
      include: appointmentInclude,
    });
  }

  static async rescheduleAppointment(id: string, date: Date, time: string, reason?: string): Promise<AppointmentWithRelations> {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Appointment not found', 404);
    }

    const updates: Prisma.AppointmentUncheckedUpdateInput = {
      date: normalizeDate(date),
      time,
      status: AppointmentStatus.RESCHEDULED,
    };

    if (reason) {
      updates.notes = existing.notes ? `${existing.notes}\n${reason}` : reason;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updates,
      include: appointmentInclude,
    });

    logger.info('Appointment rescheduled', { appointmentId: id });
    return updated;
  }

  static async completeAppointment(id: string): Promise<AppointmentWithRelations> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED },
      include: appointmentInclude,
    });
  }

  static async startAppointment(id: string): Promise<AppointmentWithRelations> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.IN_PROGRESS },
      include: appointmentInclude,
    });
  }

  static async getPatientAppointments(patientId: string, page = 1, limit = 10) {
    return this.getAppointments({ patientId, page, limit });
  }

  static async getNurseAppointments(nurseId: string, page = 1, limit = 10) {
    return this.getAppointments({ nurseId, page, limit });
  }

  static async getSpecialistAppointments(specialistId: string, page = 1, limit = 10) {
    return this.getAppointments({ specialistId, page, limit });
  }

  static async getAvailableSlots(filters: GetAvailableSlotsFilters) {
    const normalizedDate = normalizeDate(filters.date);
    const participants = buildParticipantFilters(filters);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        date: normalizedDate,
        status: { notIn: [AppointmentStatus.CANCELLED] },
        ...(participants.length ? { OR: participants } : {}),
      },
      select: { time: true, duration: true },
    });

    const slots: string[] = [];
    const slotDuration = filters.duration ?? DEFAULT_SLOT_INTERVAL_MINUTES;

    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += DEFAULT_SLOT_INTERVAL_MINUTES) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStart = combineDateAndTime(normalizedDate, timeStr);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

        const hasConflict = existingAppointments.some((appointment) => {
          const existingStart = combineDateAndTime(normalizedDate, appointment.time);
          const existingEnd = new Date(existingStart.getTime() + appointment.duration * 60000);
          return existingEnd > slotStart && existingStart < slotEnd;
        });

        if (!hasConflict) {
          slots.push(timeStr);
        }
      }
    }

    return { slots, date: normalizedDate };
  }

  static async getCalendarView(userId: string, startDate: Date, endDate: Date) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    if (user.role === UserRole.NURSE) {
      if (user.email == null) {
        return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
      }
      const nurse = await prisma.nurse.findFirst({ where: { email: user.email } });
      if (!nurse) {
        return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
      }
      return this.getAppointments({ nurseId: nurse.id, startDate, endDate, limit: 1000, page: 1 });
    }

    if (SPECIALIST_ROLES.includes(user.role)) {
      if (user.email == null) {
        return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
      }
      const specialist = await prisma.specialist.findFirst({ where: { email: user.email } });
      if (!specialist) {
        return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
      }
      return this.getAppointments({ specialistId: specialist.id, startDate, endDate, limit: 1000, page: 1 });
    }

    if (user.email == null) {
      return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
    }
    const patient = await prisma.patient.findFirst({ where: { email: user.email } });
    if (!patient) {
      return { appointments: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 1 } };
    }

    return this.getAppointments({ patientId: patient.id, startDate, endDate, limit: 1000, page: 1 });
  }

  static async markAsNoShow(id: string): Promise<AppointmentWithRelations> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW },
      include: appointmentInclude,
    });
  }

  static async addNotes(id: string, notes: string): Promise<AppointmentWithRelations> {
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Appointment not found', 404);
    }

    const combinedNotes = existing.notes ? `${existing.notes}\n${notes}` : notes;

    return prisma.appointment.update({
      where: { id },
      data: { notes: combinedNotes },
      include: appointmentInclude,
    });
  }
}


