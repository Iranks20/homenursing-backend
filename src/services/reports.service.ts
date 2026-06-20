import { Prisma, PaymentStatus, AppointmentStatus } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CustomReportRecord {
  id: string;
  type: string;
  filters: CustomReportFilters;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
  status: string;
}

export interface ScheduleReportData {
  type: string;
  frequency: string;
  recipients: string[];
  filters: CustomReportFilters;
}

export interface ScheduledReportRecord {
  id: string;
  type: string;
  frequency: string;
  recipients: string[];
  filters: CustomReportFilters;
  status: string;
  createdAt: string;
}

export interface ReportTemplateData {
  name: string;
  description: string;
  type: string;
  fields: string[];
  query: string;
}

export interface ReportTemplateRecord extends ReportTemplateData {
  id: string;
  createdAt: string;
}

export interface CustomReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  patientId?: string;
  nurseId?: string;
  serviceId?: string;
  [key: string]: unknown;
}

const REPORT_CATEGORY = 'reporting';
const REPORT_PREFIX = 'report_';
const REPORT_SCHEDULE_PREFIX = 'report_schedule_';
const REPORT_TEMPLATE_PREFIX = 'report_template_';

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const toDate = (value: string | undefined, field: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

const mapCustomReportRecord = (record: Prisma.SystemConfigGetPayload<{}>): CustomReportRecord => {
  const value = toJsonObject(record.value);

  const mapped: CustomReportRecord = {
    id: record.id,
    type: String(value.type ?? ''),
    filters: (value.filters as CustomReportFilters | undefined) ?? {},
    generatedAt: String(value.generatedAt ?? record.createdAt.toISOString()),
    status: String(value.status ?? 'completed'),
  };

  if (value.startDate !== undefined) {
    mapped.startDate = String(value.startDate);
  }
  if (value.endDate !== undefined) {
    mapped.endDate = String(value.endDate);
  }

  return mapped;
};

const cleanFilters = (filters: CustomReportFilters): Prisma.InputJsonObject => {
  const cleaned: Record<string, Prisma.InputJsonValue> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = value as Prisma.InputJsonValue;
      } else {
        cleaned[key] = value as Prisma.InputJsonValue;
      }
    }
  });
  return cleaned as Prisma.InputJsonObject;
};

const buildCustomReportValue = (
  type: string,
  filters: CustomReportFilters,
  startDate?: Date,
  endDate?: Date,
): Prisma.InputJsonObject => ({
  type,
  filters: cleanFilters(filters),
  startDate: startDate?.toISOString(),
  endDate: endDate?.toISOString(),
  generatedAt: new Date().toISOString(),
  status: 'completed',
});

const mapScheduledReportRecord = (record: Prisma.SystemConfigGetPayload<{}>): ScheduledReportRecord => {
  const value = toJsonObject(record.value);

  return {
    id: record.id,
    type: String(value.type ?? ''),
    frequency: String(value.frequency ?? ''),
    recipients: (value.recipients as string[] | undefined) ?? [],
    filters: (value.filters as CustomReportFilters | undefined) ?? {},
    status: String(value.status ?? 'active'),
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };
};

const buildScheduleValue = (data: ScheduleReportData): Prisma.InputJsonObject => ({
  type: data.type,
  frequency: data.frequency,
  recipients: data.recipients,
  filters: cleanFilters(data.filters),
  status: 'active',
  createdAt: new Date().toISOString(),
});

const mapTemplateRecord = (record: Prisma.SystemConfigGetPayload<{}>): ReportTemplateRecord => {
  const value = toJsonObject(record.value);

  return {
    id: record.id,
    name: String(value.name ?? ''),
    description: String(value.description ?? ''),
    type: String(value.type ?? ''),
    fields: (value.fields as string[] | undefined) ?? [],
    query: String(value.query ?? ''),
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };
};

const buildTemplateValue = (data: ReportTemplateData): Prisma.InputJsonObject => ({
  name: data.name,
  description: data.description,
  type: data.type,
  fields: data.fields,
  query: data.query,
  createdAt: new Date().toISOString(),
});

const applyDateFilters = (filters: CustomReportFilters, field: Prisma.DateTimeFilter, fieldName: string) => {
  const start = toDate(filters.startDate, `${fieldName} startDate`);
  const end = toDate(filters.endDate, `${fieldName} endDate`);
  if (start) field.gte = start;
  if (end) field.lte = end;
};

export class ReportsService {
  static async generateCustomReport(type: string, filters: CustomReportFilters, startDate?: Date, endDate?: Date): Promise<CustomReportRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${REPORT_PREFIX}${type}_${Date.now()}`,
        category: REPORT_CATEGORY,
        value: buildCustomReportValue(type, filters, startDate, endDate),
      },
    });

    logger.info('Custom report generated', { reportId: record.id, type });
    return mapCustomReportRecord(record);
  }

  static async scheduleReport(data: ScheduleReportData): Promise<ScheduledReportRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${REPORT_SCHEDULE_PREFIX}${Date.now()}`,
        category: REPORT_CATEGORY,
        value: buildScheduleValue(data),
      },
    });

    logger.info('Report scheduled', { scheduleId: record.id });
    return mapScheduledReportRecord(record);
  }

  static async getReportTemplates(): Promise<ReportTemplateRecord[]> {
    const templates = await prisma.systemConfig.findMany({
      where: { key: { startsWith: REPORT_TEMPLATE_PREFIX } },
      orderBy: { createdAt: 'desc' },
    });

    if (templates.length === 0) {
      return [
        {
          id: 'appointments',
          name: 'Appointment Report',
          description: 'Detailed appointment report',
          type: 'appointments',
          fields: ['date', 'patient', 'nurse', 'service', 'status'],
          query: 'SELECT * FROM appointments',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'revenue',
          name: 'Revenue Report',
          description: 'Financial revenue report',
          type: 'revenue',
          fields: ['date', 'amount', 'service', 'paymentMethod'],
          query: 'SELECT * FROM payments',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return templates.map(mapTemplateRecord);
  }

  static async createReportTemplate(data: ReportTemplateData): Promise<ReportTemplateRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${REPORT_TEMPLATE_PREFIX}${Date.now()}`,
        category: REPORT_CATEGORY,
        value: buildTemplateValue(data),
      },
    });

    logger.info('Report template created', { templateId: record.id });
    return mapTemplateRecord(record);
  }

  static async getAppointmentReport(filters: CustomReportFilters) {
    const where: Prisma.AppointmentWhereInput = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.serviceId) where.serviceId = filters.serviceId;
    if (filters.status) where.status = filters.status as AppointmentStatus;

    if (filters.startDate || filters.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      applyDateFilters(filters, dateFilter, 'appointment');
      where.date = dateFilter;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { patient: true, service: true, nurse: true },
      orderBy: { date: 'desc' },
    });

    return { appointments, total: appointments.length };
  }

  static async getRevenueReport(filters: CustomReportFilters) {
    const where: Prisma.PaymentWhereInput = { status: PaymentStatus.COMPLETED };

    if (filters.startDate || filters.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      applyDateFilters(filters, dateFilter, 'payment');
      where.date = dateFilter;
    }

    if (filters.patientId) where.patientId = filters.patientId;

    const [payments, aggregate] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { patient: true, invoice: true },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      payments,
      totalAmount: aggregate._sum.amount ?? 0,
      totalCount: aggregate._count._all ?? 0,
    };
  }

  static async getPatientSatisfactionReport(filters: CustomReportFilters) {
    const where: Prisma.FeedbackWhereInput = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.serviceId) where.serviceId = filters.serviceId;

    if (filters.startDate || filters.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      applyDateFilters(filters, dateFilter, 'feedback');
      where.date = dateFilter;
    }

    const [feedbacks, avgRating] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { patient: true },
        orderBy: { date: 'desc' },
      }),
      prisma.feedback.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    return {
      feedbacks,
      averageRating: avgRating._avg.rating ?? 0,
      total: feedbacks.length,
    };
  }

  static async getNurseUtilizationReport(filters: CustomReportFilters) {
    const dateFilter: Prisma.DateTimeFilter | undefined = (filters.startDate || filters.endDate)
      ? {}
      : undefined;

    if (dateFilter) {
      applyDateFilters(filters, dateFilter, 'appointment');
    }

    const nurses = await prisma.nurse.findMany({
      where: { status: 'ACTIVE' },
      include: {
        appointments: dateFilter
          ? {
              where: {
                date: dateFilter,
              },
            }
          : true,
      },
    });

    return nurses.map(nurse => ({
      nurse,
      appointmentCount: nurse.appointments?.length ?? 0,
      utilization: 0,
    }));
  }

  static async exportReport(type: string, format: string = 'json') {
    return {
      exportId: `export_${type}_${Date.now()}`,
      type,
      format,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/v1/reports/download/${type}_${Date.now()}.${format}`,
    };
  }
}

