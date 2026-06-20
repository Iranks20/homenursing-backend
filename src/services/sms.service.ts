import { Prisma, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { EgoSmsService, normalizePhoneNumber, isLikelyValidPhone } from './egoSms.service';

const SMS_PREFIX = 'sms_message_';
const SMS_CATEGORY = 'sms_message';
const TEMPLATE_PREFIX = 'sms_template_';
const TEMPLATE_CATEGORY = 'sms_template';

export type SmsCategory =
  | 'appointment'
  | 'prescription'
  | 'birthday'
  | 'payment'
  | 'general';

export type SmsStatus = 'queued' | 'sent' | 'failed' | 'partial';

export interface SmsRecipientInput {
  patientId?: string;
  name?: string;
  phone: string;
}

export interface SmsRecipientResult {
  phone: string;
  patientId?: string;
  name?: string;
  ok: boolean;
  status: string;
  message: string;
}

export interface SmsRecord {
  id: string;
  message: string;
  category: SmsCategory;
  status: SmsStatus;
  sentBy?: string;
  sentByName?: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  results: SmsRecipientResult[];
  createdAt: string;
  appointmentId?: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  category: SmsCategory;
  message: string;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_TEMPLATES: SmsTemplate[] = [
  {
    id: 'prescription',
    name: 'Medication Prescription',
    category: 'prescription',
    message:
      'Hi {{name}}, please take {{medication}} as prescribed. Reach out if you experience any issues. - Teamwork Physiotherapy',
    isSystem: true,
  },
  {
    id: 'birthday',
    name: 'Happy Birthday',
    category: 'birthday',
    message:
      'Happy Birthday {{name}}! Wishing you health and joy this year. - Teamwork Physiotherapy',
    isSystem: true,
  },
  {
    id: 'payment-reminder',
    name: 'Payment Reminder',
    category: 'payment',
    message:
      'Hi {{name}}, this is a friendly reminder that your invoice {{invoice}} of {{amount}} is due {{dueDate}}.',
    isSystem: true,
  },
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    category: 'appointment',
    message:
      'Hi {{name}}, your appointment is scheduled for {{date}} at {{time}}. - Teamwork Physiotherapy',
    isSystem: true,
  },
];

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const mapMessage = (record: Prisma.SystemConfigGetPayload<{}>): SmsRecord | null => {
  if (!record.key.startsWith(SMS_PREFIX)) return null;
  const value = toJsonObject(record.value);
  const results = Array.isArray(value.results) ? (value.results as unknown as SmsRecipientResult[]) : [];
  const status = (value.status as SmsStatus) || 'queued';

  const message: SmsRecord = {
    id: record.id,
    message: String(value.message ?? ''),
    category: (value.category as SmsCategory) || 'general',
    status,
    recipientCount: Number(value.recipientCount ?? results.length),
    successCount: Number(value.successCount ?? results.filter((r) => r.ok).length),
    failureCount: Number(value.failureCount ?? results.filter((r) => !r.ok).length),
    results,
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };

  if (typeof value.sentBy === 'string') message.sentBy = value.sentBy;
  if (typeof value.sentByName === 'string') message.sentByName = value.sentByName;
  if (typeof value.appointmentId === 'string') message.appointmentId = value.appointmentId;

  return message;
};

const mapTemplate = (record: Prisma.SystemConfigGetPayload<{}>): SmsTemplate | null => {
  if (!record.key.startsWith(TEMPLATE_PREFIX)) return null;
  const value = toJsonObject(record.value);
  return {
    id: record.id,
    name: String(value.name ?? ''),
    category: (value.category as SmsCategory) || 'general',
    message: String(value.message ?? ''),
    isSystem: false,
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
    updatedAt: String(value.updatedAt ?? record.updatedAt.toISOString()),
  };
};

export interface SendSmsInput {
  message: string;
  category?: SmsCategory;
  recipients: SmsRecipientInput[];
  patientIds?: string[];
  sentBy?: string;
  sentByName?: string;
  appointmentId?: string;
}

export type DirectoryRecipientType =
  | 'patient'
  | 'nurse'
  | 'specialist'
  | 'therapist'
  | 'receptionist'
  | 'biller'
  | 'admin'
  | 'lab_attendant';

export interface DirectoryRecipient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: DirectoryRecipientType;
  subtitle?: string;
}

export interface DirectoryQuery {
  type?: DirectoryRecipientType | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface DirectoryResult {
  data: DirectoryRecipient[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STAFF_USER_ROLES: Record<Exclude<DirectoryRecipientType, 'patient' | 'nurse' | 'specialist' | 'therapist'>, UserRole> = {
  receptionist: UserRole.RECEPTIONIST,
  biller: UserRole.BILLER,
  admin: UserRole.ADMIN,
  lab_attendant: UserRole.LAB_ATTENDANT,
};

const ALL_DIRECTORY_TYPES: DirectoryRecipientType[] = [
  'patient',
  'nurse',
  'specialist',
  'therapist',
  'receptionist',
  'biller',
  'admin',
  'lab_attendant',
];

export class SmsService {
  static async resolvePatientRecipients(patientIds: string[]): Promise<SmsRecipientInput[]> {
    if (!patientIds.length) return [];
    const patients = await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, name: true, phone: true },
    });
    return patients.map((p) => ({ patientId: p.id, name: p.name, phone: p.phone || '' }));
  }

  static async send(input: SendSmsInput): Promise<SmsRecord> {
    const merged = [
      ...(input.recipients ?? []),
      ...(input.patientIds?.length ? await this.resolvePatientRecipients(input.patientIds) : []),
    ];

    const dedupedByPhone = new Map<string, SmsRecipientInput>();
    for (const recipient of merged) {
      const phone = normalizePhoneNumber(recipient.phone ?? '');
      if (!phone) continue;
      if (!dedupedByPhone.has(phone)) {
        dedupedByPhone.set(phone, { ...recipient, phone });
      }
    }
    const recipients = Array.from(dedupedByPhone.values());

    if (recipients.length === 0) {
      throw new CustomError('At least one valid recipient is required', 400);
    }

    if (!input.message || input.message.trim().length === 0) {
      throw new CustomError('Message body is required', 400);
    }

    const results: SmsRecipientResult[] = [];
    for (const recipient of recipients) {
      const personalized = input.message.replace(/\{\{\s*name\s*\}\}/gi, recipient.name ?? 'there');
      const send = await EgoSmsService.sendOne({ to: recipient.phone, message: personalized });
      const result: SmsRecipientResult = {
        phone: recipient.phone,
        ok: send.ok,
        status: send.status,
        message: send.message,
      };
      if (recipient.patientId) result.patientId = recipient.patientId;
      if (recipient.name) result.name = recipient.name;
      results.push(result);
    }

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.length - successCount;

    let status: SmsStatus = 'sent';
    if (successCount === 0) status = 'failed';
    else if (failureCount > 0) status = 'partial';

    const value: Record<string, unknown> = {
      message: input.message,
      category: input.category ?? 'general',
      status,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      results,
      createdAt: new Date().toISOString(),
    };
    if (input.sentBy) value.sentBy = input.sentBy;
    if (input.sentByName) value.sentByName = input.sentByName;
    if (input.appointmentId) value.appointmentId = input.appointmentId;

    const stored = await prisma.systemConfig.create({
      data: {
        key: `${SMS_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        category: SMS_CATEGORY,
        value: value as Prisma.InputJsonObject,
      },
    });

    const mapped = mapMessage(stored);
    if (!mapped) {
      throw new CustomError('Failed to record SMS message', 500);
    }
    return mapped;
  }

  static async list(params: { page?: number; limit?: number; category?: SmsCategory; patientId?: string } = {}) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);
    const skip = (page - 1) * limit;

    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: SMS_PREFIX },
      category: SMS_CATEGORY,
    };

    if (params.category) {
      where.value = { path: ['category'], equals: params.category } as Prisma.JsonFilter;
    }

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemConfig.count({ where }),
    ]);

    let messages = records
      .map(mapMessage)
      .filter((r): r is SmsRecord => r !== null);

    if (params.patientId) {
      messages = messages.filter((m) =>
        (m.results ?? []).some((r) => r.patientId === params.patientId)
      );
    }

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  static async getById(id: string): Promise<SmsRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) return null;
    return mapMessage(record);
  }

  static async listTemplates(): Promise<SmsTemplate[]> {
    const records = await prisma.systemConfig.findMany({
      where: { key: { startsWith: TEMPLATE_PREFIX }, category: TEMPLATE_CATEGORY },
      orderBy: { createdAt: 'desc' },
    });
    const custom = records
      .map(mapTemplate)
      .filter((t): t is SmsTemplate => t !== null);
    return [...DEFAULT_TEMPLATES, ...custom];
  }

  static async createTemplate(data: {
    name: string;
    category: SmsCategory;
    message: string;
  }): Promise<SmsTemplate> {
    if (!data.name || !data.message) {
      throw new CustomError('Template name and message are required', 400);
    }
    const now = new Date().toISOString();
    const record = await prisma.systemConfig.create({
      data: {
        key: `${TEMPLATE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        category: TEMPLATE_CATEGORY,
        value: {
          name: data.name,
          category: data.category ?? 'general',
          message: data.message,
          createdAt: now,
          updatedAt: now,
        } as Prisma.InputJsonObject,
      },
    });
    const mapped = mapTemplate(record);
    if (!mapped) {
      throw new CustomError('Failed to create template', 500);
    }
    return mapped;
  }

  static async deleteTemplate(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(TEMPLATE_PREFIX)) {
      throw new CustomError('Template not found', 404);
    }
    await prisma.systemConfig.delete({ where: { id } });
  }

  static async getDirectory(query: DirectoryQuery): Promise<DirectoryResult> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = (query.search ?? '').trim();
    const type = query.type ?? 'all';

    const fetchByType = async (
      kind: DirectoryRecipientType
    ): Promise<{ items: DirectoryRecipient[]; total: number }> => {
      const isPaginated = type === kind;
      const fetchSkip = isPaginated ? skip : 0;
      const fetchTake = isPaginated ? limit : 200;

      if (kind === 'patient') {
        const where: Prisma.PatientWhereInput = search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {};
        const [rows, total] = await Promise.all([
          prisma.patient.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, phone: true, email: true, condition: true },
            skip: fetchSkip,
            take: fetchTake,
          }),
          prisma.patient.count({ where }),
        ]);
        const items: DirectoryRecipient[] = rows.map((row) => {
          const item: DirectoryRecipient = {
            id: row.id,
            name: row.name,
            phone: row.phone ?? '',
            type: 'patient',
          };
          if (row.email) item.email = row.email;
          if (row.condition) item.subtitle = row.condition;
          return item;
        });
        return { items, total };
      }

      if (kind === 'nurse') {
        const where: Prisma.NurseWhereInput = search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { specialization: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {};
        const [rows, total] = await Promise.all([
          prisma.nurse.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, phone: true, email: true, specialization: true },
            skip: fetchSkip,
            take: fetchTake,
          }),
          prisma.nurse.count({ where }),
        ]);
        return {
          items: rows.map((row) => {
            const item: DirectoryRecipient = {
              id: row.id,
              name: row.name,
              phone: row.phone ?? '',
              type: 'nurse',
            };
            if (row.email) item.email = row.email;
            if (row.specialization) item.subtitle = row.specialization;
            return item;
          }),
          total,
        };
      }

      if (kind === 'specialist') {
        const where: Prisma.SpecialistWhereInput = search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { specialization: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {};
        const [rows, total] = await Promise.all([
          prisma.specialist.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, phone: true, email: true, specialization: true },
            skip: fetchSkip,
            take: fetchTake,
          }),
          prisma.specialist.count({ where }),
        ]);
        return {
          items: rows.map((row) => {
            const item: DirectoryRecipient = {
              id: row.id,
              name: row.name,
              phone: row.phone ?? '',
              type: 'specialist',
            };
            if (row.email) item.email = row.email;
            if (row.specialization) item.subtitle = row.specialization;
            return item;
          }),
          total,
        };
      }

      if (kind === 'therapist') {
        const where: Prisma.TherapistWhereInput = search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { specialization: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {};
        const [rows, total] = await Promise.all([
          prisma.therapist.findMany({
            where,
            orderBy: { name: 'asc' },
            select: { id: true, name: true, phone: true, email: true, specialization: true },
            skip: fetchSkip,
            take: fetchTake,
          }),
          prisma.therapist.count({ where }),
        ]);
        return {
          items: rows.map((row) => {
            const item: DirectoryRecipient = {
              id: row.id,
              name: row.name,
              phone: row.phone ?? '',
              type: 'therapist',
            };
            if (row.email) item.email = row.email;
            if (row.specialization) item.subtitle = row.specialization;
            return item;
          }),
          total,
        };
      }

      const role = STAFF_USER_ROLES[kind];
      const where: Prisma.UserWhereInput = {
        role,
        phone: { not: null },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { name: 'asc' },
          select: { id: true, name: true, phone: true, email: true, role: true },
          skip: fetchSkip,
          take: fetchTake,
        }),
        prisma.user.count({ where }),
      ]);
      return {
        items: rows.map((row) => {
          const item: DirectoryRecipient = {
            id: row.id,
            name: row.name,
            phone: row.phone ?? '',
            type: kind,
          };
          if (row.email) item.email = row.email;
          item.subtitle = row.role.toString().toLowerCase().replace(/_/g, ' ');
          return item;
        }),
        total,
      };
    };

    if (type !== 'all') {
      const { items, total } = await fetchByType(type);
      return {
        data: items,
        pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
      };
    }

    const buckets = await Promise.all(ALL_DIRECTORY_TYPES.map((t) => fetchByType(t)));
    const combined: DirectoryRecipient[] = buckets.flatMap((bucket) => bucket.items);
    const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

    combined.sort((a, b) => a.name.localeCompare(b.name));
    const paginated = combined.slice(skip, skip + limit);

    return {
      data: paginated,
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  }

  private static formatAppointmentDateLabel(date: Date): string {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  static async sendAppointmentReminderToPatient(input: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    date: Date;
    time: string;
    serviceName?: string | null;
    providerName?: string | null;
    appointmentId: string;
    sentBy?: string;
    sentByName?: string;
  }): Promise<SmsRecord | null> {
    const phone = normalizePhoneNumber(input.patientPhone ?? '');
    if (!isLikelyValidPhone(phone)) {
      return null;
    }

    const dateLabel = this.formatAppointmentDateLabel(input.date);
    const parts: string[] = [
      `Hi ${input.patientName || 'there'},`,
      `reminder: your appointment${input.serviceName ? ` for ${input.serviceName}` : ''} is on ${dateLabel} at ${input.time}.`,
    ];
    if (input.providerName) {
      parts.push(`Your provider: ${input.providerName}.`);
    }
    parts.push('- Teamwork Physiotherapy');

    const sendInput: SendSmsInput = {
      message: parts.join(' '),
      category: 'appointment',
      recipients: [{ patientId: input.patientId, name: input.patientName, phone }],
      appointmentId: input.appointmentId,
    };
    if (input.sentBy) sendInput.sentBy = input.sentBy;
    if (input.sentByName) sendInput.sentByName = input.sentByName;

    try {
      return await this.send(sendInput);
    } catch (error) {
      logger.warn('Failed to send appointment reminder SMS to patient', {
        error: error instanceof Error ? error.message : String(error),
        appointmentId: input.appointmentId,
      });
      return null;
    }
  }

  static async sendAppointmentReminderToProvider(input: {
    providerName: string;
    providerPhone: string;
    patientName: string;
    date: Date;
    time: string;
    serviceName?: string | null;
    appointmentId: string;
    sentBy?: string;
    sentByName?: string;
  }): Promise<SmsRecord | null> {
    const phone = normalizePhoneNumber(input.providerPhone ?? '');
    if (!isLikelyValidPhone(phone)) {
      return null;
    }

    const dateLabel = this.formatAppointmentDateLabel(input.date);
    const parts: string[] = [
      `Hi ${input.providerName || 'there'},`,
      `reminder: you have an appointment with ${input.patientName} on ${dateLabel} at ${input.time}`,
    ];
    if (input.serviceName) {
      parts.push(`(${input.serviceName})`);
    }
    parts.push('. - Teamwork Physiotherapy');

    const sendInput: SendSmsInput = {
      message: parts.join(' '),
      category: 'appointment',
      recipients: [{ name: input.providerName, phone }],
      appointmentId: input.appointmentId,
    };
    if (input.sentBy) sendInput.sentBy = input.sentBy;
    if (input.sentByName) sendInput.sentByName = input.sentByName;

    try {
      return await this.send(sendInput);
    } catch (error) {
      logger.warn('Failed to send appointment reminder SMS to provider', {
        error: error instanceof Error ? error.message : String(error),
        appointmentId: input.appointmentId,
      });
      return null;
    }
  }

  static async sendBirthdayGreeting(input: {
    recipientName: string;
    phone: string;
    patientId?: string;
    sentBy?: string;
    sentByName?: string;
  }): Promise<SmsRecord | null> {
    const phone = normalizePhoneNumber(input.phone ?? '');
    if (!isLikelyValidPhone(phone)) {
      return null;
    }

    const templates = await this.listTemplates();
    const birthdayTemplate = templates.find((t) => t.category === 'birthday' && t.isSystem);
    const templateMessage =
      birthdayTemplate?.message ??
      'Happy Birthday {{name}}! Wishing you health and joy this year. - Teamwork Physiotherapy';

    const message = templateMessage.replace(/\{\{\s*name\s*\}\}/gi, input.recipientName || 'there');

    const recipient: SmsRecipientInput = {
      name: input.recipientName,
      phone,
    };
    if (input.patientId) recipient.patientId = input.patientId;

    const sendInput: SendSmsInput = {
      message,
      category: 'birthday',
      recipients: [recipient],
    };
    if (input.sentBy) sendInput.sentBy = input.sentBy;
    if (input.sentByName) sendInput.sentByName = input.sentByName;

    try {
      return await this.send(sendInput);
    } catch (error) {
      logger.warn('Failed to send birthday SMS', {
        error: error instanceof Error ? error.message : String(error),
        patientId: input.patientId,
      });
      return null;
    }
  }
}
