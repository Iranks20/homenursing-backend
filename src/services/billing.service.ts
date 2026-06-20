import {
  Invoice,
  Payment,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  UserRole,
  SpecialistStatus,
  TherapistStatus,
} from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface InvoiceLineInput {
  serviceId?: string;
  consultationProviderId?: string;
  consultationSpecialistId?: string;
  consultationTherapistId?: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  procedureCode?: string | null;
}

export type ConsultationProviderSource = 'user' | 'specialist' | 'therapist';

export interface ConsultationProvider {
  source: ConsultationProviderSource;
  id: string;
  name: string;
  role: 'specialist' | 'therapist';
  specialization?: string | null;
  consultationFee: number;
}

const CONSULTATION_SERVICE_NAME = 'Consultation';
const CONSULTATION_SERVICE_CATEGORY = 'Consultation';
const CONSULTATION_SERVICE_DESCRIPTION =
  'Professional consultation fee billed against a specialist or therapist consultation rate.';

let cachedConsultationServiceId: string | null = null;

async function ensureConsultationService(): Promise<string> {
  if (cachedConsultationServiceId) {
    return cachedConsultationServiceId;
  }
  const existing = await prisma.service.findFirst({
    where: {
      category: CONSULTATION_SERVICE_CATEGORY,
      name: CONSULTATION_SERVICE_NAME,
    },
  });
  if (existing) {
    cachedConsultationServiceId = existing.id;
    return existing.id;
  }
  const created = await prisma.service.create({
    data: {
      name: CONSULTATION_SERVICE_NAME,
      description: CONSULTATION_SERVICE_DESCRIPTION,
      category: CONSULTATION_SERVICE_CATEGORY,
      price: 0,
      duration: 30,
      features: [],
      isActive: true,
    },
  });
  cachedConsultationServiceId = created.id;
  return created.id;
}

function formatProviderRole(role: string): 'specialist' | 'therapist' | null {
  const normalized = role.toUpperCase();
  if (normalized === 'SPECIALIST') return 'specialist';
  if (normalized === 'THERAPIST') return 'therapist';
  return null;
}

function buildConsultationDescription(provider: {
  name: string;
  role: string;
  specialistSpecialization?: string | null;
  therapistSpecialization?: string | null;
}): string {
  const roleSlug = formatProviderRole(provider.role);
  const specialization =
    roleSlug === 'specialist'
      ? provider.specialistSpecialization
      : roleSlug === 'therapist'
      ? provider.therapistSpecialization
      : null;
  const cleanSpec = specialization ? specialization.replace(/_/g, ' ').toLowerCase() : null;
  const roleLabel = roleSlug === 'specialist' ? 'Specialist' : roleSlug === 'therapist' ? 'Therapist' : 'Provider';
  const specPart = cleanSpec ? ` (${cleanSpec} ${roleLabel.toLowerCase()})` : ` (${roleLabel.toLowerCase()})`;
  return `Consultation — ${provider.name}${specPart}`;
}

function buildRosterConsultationDescription(
  name: string,
  specialization: string | null,
  roleLabel: 'specialist' | 'therapist'
): string {
  const cleanSpec = specialization ? specialization.replace(/_/g, ' ').toLowerCase() : null;
  const specPart = cleanSpec ? ` (${cleanSpec} ${roleLabel})` : ` (${roleLabel})`;
  return `Consultation — ${name}${specPart}`;
}

export interface CreateInvoiceData {
  patientId: string;
  date: Date;
  dueDate: Date;
  description: string;
  status?: InvoiceStatus;
  lines?: InvoiceLineInput[];
  serviceId?: string;
  amount?: number;
}

export type UpdateInvoiceData = Partial<CreateInvoiceData> & {
  lines?: InvoiceLineInput[];
};

export interface CreatePaymentData {
  patientId: string;
  invoiceId: string;
  amount: number;
  method: string;
  description: string;
  transactionId?: string;
  status?: PaymentStatus;
}

const toDate = (value: Date | string, field: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

const PAD_LEN = 6;

const invoiceDetailInclude = {
  patient: { select: { id: true, name: true, email: true } },
  lineItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      service: { select: { id: true, name: true } },
      consultationProvider: {
        select: {
          id: true,
          name: true,
          role: true,
          specialistSpecialization: true,
          therapistSpecialization: true,
        },
      },
      consultationSpecialist: { select: { id: true, name: true, specialization: true } },
      consultationTherapist: { select: { id: true, name: true, specialization: true } },
    },
  },
  payments: {
    orderBy: { date: 'desc' as const },
    take: 1,
    select: { method: true },
  },
} as const;

const invoiceListInclude = {
  patient: { select: { id: true, name: true, email: true } },
  lineItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      service: { select: { id: true, name: true } },
      consultationProvider: {
        select: {
          id: true,
          name: true,
          role: true,
          specialistSpecialization: true,
          therapistSpecialization: true,
        },
      },
      consultationSpecialist: { select: { id: true, name: true, specialization: true } },
      consultationTherapist: { select: { id: true, name: true, specialization: true } },
    },
  },
  payments: {
    orderBy: { date: 'desc' as const },
    take: 1,
    select: { method: true },
  },
} as const;

type InvoiceWithListRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceListInclude }>;
type InvoiceWithDetailRelations = Prisma.InvoiceGetPayload<{ include: typeof invoiceDetailInclude }>;

function displayLineName(li: InvoiceWithListRelations['lineItems'][number]): string {
  if (li.consultationProvider) {
    const provider = li.consultationProvider;
    return `Consultation — ${provider.name}`;
  }
  if (li.consultationSpecialist) {
    return `Consultation — ${li.consultationSpecialist.name}`;
  }
  if (li.consultationTherapist) {
    return `Consultation — ${li.consultationTherapist.name}`;
  }
  return li.service?.name ?? '—';
}

function summarizeLineServiceNames(items: InvoiceWithListRelations['lineItems']): string {
  const names = items.map((li) => displayLineName(li)).filter(Boolean);
  if (names.length === 0) return '—';
  const unique = [...new Set(names)];
  if (unique.length === 1) return unique[0] ?? '—';
  if (unique.length === 2) return unique.join(', ');
  return `${unique.slice(0, 2).join(', ')} +${unique.length - 2} more`;
}

function toInvoiceApiShape(invoice: InvoiceWithListRelations | InvoiceWithDetailRelations) {
  const items = invoice.lineItems ?? [];
  const latestPaymentMethod = invoice.payments?.[0]?.method;
  return {
    ...invoice,
    patientName: invoice.patient?.name,
    serviceName: summarizeLineServiceNames(items),
    paymentMethod: latestPaymentMethod != null ? String(latestPaymentMethod) : undefined,
    lineItems: items.map((li) => ({
      id: li.id,
      serviceId: li.serviceId,
      serviceName: displayLineName(li),
      consultationProviderId: li.consultationProviderId ?? null,
      consultationProviderName: li.consultationProvider?.name ?? null,
      consultationSpecialistId: li.consultationSpecialistId ?? null,
      consultationSpecialistName: li.consultationSpecialist?.name ?? null,
      consultationTherapistId: li.consultationTherapistId ?? null,
      consultationTherapistName: li.consultationTherapist?.name ?? null,
      procedureCode: li.procedureCode,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineAmount: li.lineAmount,
      sortOrder: li.sortOrder,
    })),
  };
}

type ResolvedLine = {
  serviceId: string;
  consultationProviderId: string | null;
  consultationSpecialistId: string | null;
  consultationTherapistId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  procedureCode: string | null;
};

async function getNextInvoiceNumber(): Promise<string> {
  const count = await prisma.invoice.count();
  return String(count + 1).padStart(PAD_LEN, '0');
}

export class BillingService {
  private static async resolveLineInputs(lines: InvoiceLineInput[]): Promise<ResolvedLine[]> {
    if (!lines.length) {
      throw new CustomError('At least one invoice line is required', 400);
    }

    const serviceIds = [
      ...new Set(
        lines
          .map((l) => l.serviceId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    const providerIds = [
      ...new Set(
        lines
          .map((l) => l.consultationProviderId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    const specialistIds = [
      ...new Set(
        lines
          .map((l) => l.consultationSpecialistId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];
    const therapistIds = [
      ...new Set(
        lines
          .map((l) => l.consultationTherapistId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ];

    const [services, providers, rosterSpecialists, rosterTherapists] = await Promise.all([
      serviceIds.length > 0
        ? prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : Promise.resolve([]),
      providerIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: providerIds } },
            select: {
              id: true,
              name: true,
              role: true,
              consultationFee: true,
              specialistSpecialization: true,
              therapistSpecialization: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
      specialistIds.length > 0
        ? prisma.specialist.findMany({
            where: { id: { in: specialistIds } },
            select: { id: true, name: true, specialization: true, hourlyRate: true, status: true },
          })
        : Promise.resolve([]),
      therapistIds.length > 0
        ? prisma.therapist.findMany({
            where: { id: { in: therapistIds } },
            select: { id: true, name: true, specialization: true, hourlyRate: true, status: true },
          })
        : Promise.resolve([]),
    ]);
    const svcMap = new Map(services.map((s) => [s.id, s]));
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const specialistMap = new Map(rosterSpecialists.map((s) => [s.id, s]));
    const therapistMap = new Map(rosterTherapists.map((t) => [t.id, t]));

    let consultationServiceId: string | null = null;
    const ensureCachedConsultationService = async (): Promise<string> => {
      if (consultationServiceId) return consultationServiceId;
      consultationServiceId = await ensureConsultationService();
      return consultationServiceId;
    };

    const resolved: ResolvedLine[] = [];
    for (const line of lines) {
      const qty = Math.max(1, Math.floor(line.quantity ?? 1));

      if (line.consultationProviderId) {
        const provider = providerMap.get(line.consultationProviderId);
        if (!provider) {
          throw new CustomError('Consultation provider not found', 404);
        }
        const providerRole = formatProviderRole(provider.role);
        if (!providerRole) {
          throw new CustomError('Selected user is not a specialist or therapist', 400);
        }
        const consultationFee = Number(provider.consultationFee ?? 0);
        const unit =
          line.unitPrice != null && !Number.isNaN(Number(line.unitPrice))
            ? Number(line.unitPrice)
            : consultationFee;
        if (!Number.isFinite(unit) || unit <= 0) {
          throw new CustomError(
            `${provider.name} has no consultation rate set. Please set the rate on the Consultation rates page first.`,
            400
          );
        }
        const lineAmount = Math.round(qty * unit * 100) / 100;
        const svcId = await ensureCachedConsultationService();
        resolved.push({
          serviceId: svcId,
          consultationProviderId: provider.id,
          consultationSpecialistId: null,
          consultationTherapistId: null,
          description:
            (line.description && line.description.trim()) || buildConsultationDescription(provider),
          quantity: qty,
          unitPrice: unit,
          lineAmount,
          procedureCode: line.procedureCode ?? null,
        });
        continue;
      }

      if (line.consultationSpecialistId) {
        const spec = specialistMap.get(line.consultationSpecialistId);
        if (!spec) {
          throw new CustomError('Specialist not found', 404);
        }
        if (spec.status !== SpecialistStatus.ACTIVE) {
          throw new CustomError('Selected specialist is not active', 400);
        }
        const defaultRate = Math.round(Number(spec.hourlyRate ?? 0));
        const unit =
          line.unitPrice != null && !Number.isNaN(Number(line.unitPrice))
            ? Number(line.unitPrice)
            : defaultRate;
        if (!Number.isFinite(unit) || unit <= 0) {
          throw new CustomError(
            `${spec.name} has no hourly rate on file. Enter a unit price on the invoice line, or set the hourly rate on the Specialist profile.`,
            400
          );
        }
        const lineAmount = Math.round(qty * unit * 100) / 100;
        const svcId = await ensureCachedConsultationService();
        resolved.push({
          serviceId: svcId,
          consultationProviderId: null,
          consultationSpecialistId: spec.id,
          consultationTherapistId: null,
          description:
            (line.description && line.description.trim()) ||
            buildRosterConsultationDescription(spec.name, spec.specialization, 'specialist'),
          quantity: qty,
          unitPrice: unit,
          lineAmount,
          procedureCode: line.procedureCode ?? null,
        });
        continue;
      }

      if (line.consultationTherapistId) {
        const th = therapistMap.get(line.consultationTherapistId);
        if (!th) {
          throw new CustomError('Therapist not found', 404);
        }
        if (th.status !== TherapistStatus.ACTIVE) {
          throw new CustomError('Selected therapist is not active', 400);
        }
        const defaultRate = Math.round(Number(th.hourlyRate ?? 0));
        const unit =
          line.unitPrice != null && !Number.isNaN(Number(line.unitPrice))
            ? Number(line.unitPrice)
            : defaultRate;
        if (!Number.isFinite(unit) || unit <= 0) {
          throw new CustomError(
            `${th.name} has no hourly rate on file. Enter a unit price on the invoice line, or set the hourly rate on the Therapist profile.`,
            400
          );
        }
        const lineAmount = Math.round(qty * unit * 100) / 100;
        const svcId = await ensureCachedConsultationService();
        resolved.push({
          serviceId: svcId,
          consultationProviderId: null,
          consultationSpecialistId: null,
          consultationTherapistId: th.id,
          description:
            (line.description && line.description.trim()) ||
            buildRosterConsultationDescription(th.name, th.specialization, 'therapist'),
          quantity: qty,
          unitPrice: unit,
          lineAmount,
          procedureCode: line.procedureCode ?? null,
        });
        continue;
      }

      if (!line.serviceId) {
        throw new CustomError(
          'Each line requires a service, a user consultation rate, a roster specialist, or a roster therapist',
          400
        );
      }
      const svc = svcMap.get(line.serviceId);
      if (!svc) {
        throw new CustomError('Service not found', 404);
      }
      const unit =
        line.unitPrice != null && !Number.isNaN(Number(line.unitPrice))
          ? Number(line.unitPrice)
          : Number(svc.price) || 0;
      const lineAmount = Math.round(qty * unit * 100) / 100;
      resolved.push({
        serviceId: line.serviceId,
        consultationProviderId: null,
        consultationSpecialistId: null,
        consultationTherapistId: null,
        description: (line.description && line.description.trim()) || svc.name,
        quantity: qty,
        unitPrice: unit,
        lineAmount,
        procedureCode: line.procedureCode ?? null,
      });
    }
    return resolved;
  }

  static async getConsultationProviders(): Promise<ConsultationProvider[]> {
    const [users, specRows, therRows] = await Promise.all([
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: [UserRole.SPECIALIST, UserRole.THERAPIST] },
        },
        select: {
          id: true,
          name: true,
          role: true,
          consultationFee: true,
          specialistSpecialization: true,
          therapistSpecialization: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
      prisma.specialist.findMany({
        where: { status: SpecialistStatus.ACTIVE },
        select: { id: true, name: true, specialization: true, hourlyRate: true },
        orderBy: { name: 'asc' },
      }),
      prisma.therapist.findMany({
        where: { status: TherapistStatus.ACTIVE },
        select: { id: true, name: true, specialization: true, hourlyRate: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const fromUsers = users.flatMap<ConsultationProvider>((u) => {
      const roleSlug = formatProviderRole(u.role);
      if (!roleSlug) return [];
      const fee = Math.round(Number(u.consultationFee ?? 0));
      const specialization =
        roleSlug === 'specialist' ? u.specialistSpecialization : u.therapistSpecialization;
      const provider: ConsultationProvider = {
        source: 'user',
        id: u.id,
        name: u.name,
        role: roleSlug,
        consultationFee: Number.isFinite(fee) ? fee : 0,
      };
      if (specialization) {
        provider.specialization = specialization;
      }
      return [provider];
    });

    const fromSpecialists: ConsultationProvider[] = specRows.map((s) => ({
      source: 'specialist',
      id: s.id,
      name: s.name,
      role: 'specialist' as const,
      specialization: s.specialization,
      consultationFee: Math.round(Number(s.hourlyRate ?? 0)),
    }));

    const fromTherapists: ConsultationProvider[] = therRows.map((t) => ({
      source: 'therapist',
      id: t.id,
      name: t.name,
      role: 'therapist' as const,
      specialization: t.specialization,
      consultationFee: Math.round(Number(t.hourlyRate ?? 0)),
    }));

    const providers = [...fromUsers, ...fromSpecialists, ...fromTherapists].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    logger.info('Consultation providers fetched for billing', {
      userCount: fromUsers.length,
      specialistRosterCount: fromSpecialists.length,
      therapistRosterCount: fromTherapists.length,
      total: providers.length,
    });

    return providers;
  }

  private static async resolveCreateLines(data: CreateInvoiceData): Promise<ResolvedLine[]> {
    if (data.lines && data.lines.length > 0) {
      return this.resolveLineInputs(data.lines);
    }
    if (data.serviceId && data.amount != null && !Number.isNaN(Number(data.amount))) {
      const svc = await prisma.service.findUnique({ where: { id: data.serviceId } });
      if (!svc) {
        throw new CustomError('Service not found', 404);
      }
      const amount = Number(data.amount);
      return [
        {
          serviceId: data.serviceId,
          consultationProviderId: null,
          consultationSpecialistId: null,
          consultationTherapistId: null,
          description: data.description || svc.name,
          quantity: 1,
          unitPrice: amount,
          lineAmount: amount,
          procedureCode: null,
        },
      ];
    }
    throw new CustomError('Provide lines[] or serviceId with amount', 400);
  }

  static async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    const resolved = await this.resolveCreateLines(data);
    const total = resolved.reduce((s, l) => s + l.lineAmount, 0);
    const invoiceNumber = await getNextInvoiceNumber();
    const firstLine = resolved[0];
    if (!firstLine) {
      throw new CustomError('Invoice has no lines', 400);
    }
    const primaryServiceId = firstLine.serviceId;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        patientId: data.patientId,
        serviceId: primaryServiceId,
        amount: total,
        date: toDate(data.date, 'date'),
        dueDate: toDate(data.dueDate, 'dueDate'),
        description: data.description,
        status: data.status ?? InvoiceStatus.PENDING,
        lineItems: {
          create: resolved.map((r, i) => ({
            serviceId: r.serviceId,
            consultationProviderId: r.consultationProviderId,
            consultationSpecialistId: r.consultationSpecialistId,
            consultationTherapistId: r.consultationTherapistId,
            description: r.description,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
            lineAmount: r.lineAmount,
            procedureCode: r.procedureCode,
            sortOrder: i,
          })),
        },
      },
      include: invoiceDetailInclude,
    });

    logger.info('Invoice created', { invoiceId: invoice.id });
    return toInvoiceApiShape(invoice) as any;
  }

  static async getInvoiceById(id: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: invoiceDetailInclude,
    });

    if (!invoice) return null;

    return toInvoiceApiShape(invoice) as any;
  }

  static async getInvoices(filters: {
    patientId?: string;
    page?: number;
    limit?: number;
    /** 'unpaid' (default) = PENDING+OVERDUE only, 'paid', or 'all' */
    statusFilter?: string;
    includeArchived?: boolean;
    dateFrom?: string;
    dateTo?: string;
    /** Alternative to dateFrom/dateTo: 'day'|'week'|'month' */
    period?: string;
  } = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.InvoiceWhereInput = {};

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.includeArchived !== true) (where as Record<string, unknown>).archivedAt = null;

    const statusFilter = (filters.statusFilter ?? 'unpaid').toLowerCase();
    if (statusFilter === 'unpaid') {
      where.status = { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] };
    } else if (statusFilter === 'paid') {
      where.status = InvoiceStatus.PAID;
    }
    // 'all' = no status filter

    const now = new Date();
    if (filters.period || filters.dateFrom || filters.dateTo) {
      let start: Date | undefined;
      let end: Date | undefined;
      if (filters.period) {
        switch (filters.period.toLowerCase()) {
          case 'day':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getTime());
            break;
          case 'week':
            const day = now.getDay();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            weekStart.setHours(0, 0, 0, 0);
            start = weekStart;
            end = new Date(now.getTime());
            break;
          case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getTime());
            break;
          default:
            break;
        }
      }
      if (filters.dateFrom) start = toDate(filters.dateFrom, 'dateFrom');
      if (filters.dateTo) end = toDate(filters.dateTo, 'dateTo');
      if (start != null || end != null) {
        where.date = {};
        if (start != null) (where.date as Prisma.DateTimeFilter).gte = start;
        if (end != null) (where.date as Prisma.DateTimeFilter).lte = end;
      }
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: invoiceListInclude,
      }),
      prisma.invoice.count({ where }),
    ]);

    const transformedInvoices = invoices.map((invoice) => toInvoiceApiShape(invoice));

    return {
      invoices: transformedInvoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async archiveInvoice(id: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new CustomError('Invoice not found', 404);
    const updated = await prisma.invoice.update({
      where: { id },
      data: { archivedAt: new Date() } as Prisma.InvoiceUncheckedUpdateInput,
      include: invoiceDetailInclude,
    });
    return toInvoiceApiShape(updated) as any;
  }

  static async updateInvoice(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!existing) {
      throw new CustomError('Invoice not found', 404);
    }

    if (data.lines !== undefined && data.lines.length > 0) {
      if (existing.status !== InvoiceStatus.PENDING) {
        throw new CustomError('Only pending invoices can have charges edited', 400);
      }
      const resolved = await this.resolveLineInputs(data.lines);
      const total = resolved.reduce((s, l) => s + l.lineAmount, 0);
      const head = resolved[0];
      if (!head) {
        throw new CustomError('Invoice has no lines', 400);
      }
      const headerPatch: Prisma.InvoiceUncheckedUpdateInput = {
        amount: total,
        serviceId: head.serviceId,
      };
      if (data.description !== undefined) headerPatch.description = data.description;
      if (data.date !== undefined) headerPatch.date = toDate(data.date, 'date');
      if (data.dueDate !== undefined) headerPatch.dueDate = toDate(data.dueDate, 'dueDate');
      if (data.patientId !== undefined) headerPatch.patientId = data.patientId;
      if (data.status !== undefined) headerPatch.status = data.status;

      const invoice = await prisma.$transaction(async (tx) => {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        return tx.invoice.update({
          where: { id },
          data: {
            ...headerPatch,
            lineItems: {
              create: resolved.map((r, i) => ({
                serviceId: r.serviceId,
                consultationProviderId: r.consultationProviderId,
                consultationSpecialistId: r.consultationSpecialistId,
                consultationTherapistId: r.consultationTherapistId,
                description: r.description,
                quantity: r.quantity,
                unitPrice: r.unitPrice,
                lineAmount: r.lineAmount,
                procedureCode: r.procedureCode,
                sortOrder: i,
              })),
            },
          },
          include: invoiceDetailInclude,
        });
      });

      return toInvoiceApiShape(invoice) as any;
    }

    const updates: Prisma.InvoiceUncheckedUpdateInput = {};
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;
    if (data.date !== undefined) updates.date = toDate(data.date, 'date');
    if (data.dueDate !== undefined) updates.dueDate = toDate(data.dueDate, 'dueDate');
    if (data.patientId !== undefined) updates.patientId = data.patientId;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updates,
      include: invoiceDetailInclude,
    });

    return toInvoiceApiShape(invoice) as any;
  }

  static async deleteInvoice(id: string): Promise<void> {
    await prisma.invoice.delete({ where: { id } });
  }

  static async createPayment(data: CreatePaymentData): Promise<Payment> {
    const createData: any = {
      patientId: data.patientId,
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
      description: data.description,
      status: data.status ?? PaymentStatus.COMPLETED,
      date: new Date(),
    };

    if (data.transactionId !== undefined) {
      createData.transactionId = data.transactionId;
    }

    const payment = await prisma.payment.create({
      data: createData,
      include: { patient: true, invoice: true },
    });
    logger.info('Payment created', { paymentId: payment.id });
    return payment;
  }

  static async getPaymentById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { id },
      include: { patient: true, invoice: true },
    });
  }

  static async getPayments(patientId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = patientId ? { patientId } : {};

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { patient: true, invoice: true },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  static async getRevenueReport(filters: { startDate?: string; endDate?: string }) {
    const where: Prisma.PaymentWhereInput = {
      status: PaymentStatus.COMPLETED,
    };

    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.startDate) {
      dateFilter.gte = toDate(filters.startDate, 'startDate');
    }

    if (filters.endDate) {
      dateFilter.lte = toDate(filters.endDate, 'endDate');
    }

    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

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
      totalRevenue: aggregate._sum.amount ?? 0,
      totalCount: aggregate._count._all ?? 0,
    };
  }

  static async getOutstandingPayments(filters: { patientId?: string }) {
    const where: Prisma.InvoiceWhereInput = {
      status: InvoiceStatus.PENDING,
      ...({ archivedAt: null } as Record<string, unknown>),
    };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }

    const [invoices, aggregate] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { patient: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.invoice.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      invoices,
      totalOutstanding: aggregate._sum.amount ?? 0,
      totalCount: aggregate._count._all ?? 0,
    };
  }

  /** Summary report for a period: revenue, outstanding, counts. */
  static async getBillingSummary(filters: {
    period?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}) {
    const now = new Date();
    let start: Date | undefined;
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filters.period) {
      switch (filters.period.toLowerCase()) {
        case 'day':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          break;
        case 'week':
          const day = now.getDay();
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
          weekStart.setHours(0, 0, 0, 0);
          start = weekStart;
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        default:
          break;
      }
    }
    if (filters.dateFrom) start = toDate(filters.dateFrom, 'dateFrom');
    if (filters.dateTo) end = toDate(filters.dateTo, 'dateTo');

    const dateFilter: Prisma.DateTimeFilter = {};
    if (start != null) dateFilter.gte = start;
    dateFilter.lte = end;

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.COMPLETED,
      date: dateFilter,
    };

    const [
      paymentAgg,
      pendingAgg,
      overdueAgg,
      paidInPeriodAgg,
      allInvoicesInPeriod,
      paidInvoicesUpdatedInPeriod,
      completedPaymentInvoiceIdsInPeriod,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.PENDING, ...({ archivedAt: null } as Record<string, unknown>) },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: { status: InvoiceStatus.OVERDUE, ...({ archivedAt: null } as Record<string, unknown>) },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          ...({ archivedAt: null } as Record<string, unknown>),
          updatedAt: dateFilter,
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      start != null
        ? prisma.invoice.findMany({
            where: { date: dateFilter, ...({ archivedAt: null } as Record<string, unknown>) },
            select: { id: true, amount: true, status: true },
          })
        : Promise.resolve([]),
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.PAID,
          ...({ archivedAt: null } as Record<string, unknown>),
          updatedAt: dateFilter,
        },
        select: { id: true, amount: true },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        select: { invoiceId: true },
        distinct: ['invoiceId'],
      }),
    ]);

    const totalInvoicedInPeriod =
      allInvoicesInPeriod.length > 0
        ? allInvoicesInPeriod.reduce((sum, inv) => sum + inv.amount, 0)
        : 0;

    const paymentSum = paymentAgg._sum?.amount ?? 0;
    const paidByPaymentInvoiceIds = new Set(completedPaymentInvoiceIdsInPeriod.map((p) => p.invoiceId));
    const paidInvoicesNoPaymentRecord = paidInvoicesUpdatedInPeriod.filter(
      (inv) => !paidByPaymentInvoiceIds.has(inv.id)
    );
    const revenueFromPaidInvoicesNoPayment = paidInvoicesNoPaymentRecord.reduce((sum, inv) => sum + inv.amount, 0);
    const revenue = paymentSum + revenueFromPaidInvoicesNoPayment;
    const paymentCount = (paymentAgg._count as { _all?: number })?._all ?? 0;
    const revenueCount = paymentCount + paidInvoicesNoPaymentRecord.length;

    return {
      period: filters.period ?? 'custom',
      dateFrom: start?.toISOString(),
      dateTo: end.toISOString(),
      revenue,
      revenueCount,
      totalInvoiced: totalInvoicedInPeriod,
      totalPending: pendingAgg._sum?.amount ?? 0,
      pendingCount: (pendingAgg._count as { _all?: number })?._all ?? 0,
      totalOverdue: overdueAgg._sum?.amount ?? 0,
      overdueCount: (overdueAgg._count as { _all?: number })?._all ?? 0,
      paidInPeriod: paidInPeriodAgg._sum?.amount ?? 0,
      paidCount:
        (paidInPeriodAgg._count && typeof paidInPeriodAgg._count === 'object' && '_all' in paidInPeriodAgg._count
          ? paidInPeriodAgg._count._all
          : undefined) ?? 0,
      profit: revenue,
    };
  }

  static async generateInvoice(data: { patientId: string; serviceId: string; appointmentId?: string }) {
    const service = await prisma.service.findUnique({ where: { id: data.serviceId } });

    if (!service) {
      throw new CustomError('Service not found', 404);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const price = Number(service.price) || 0;

    const invoice = await this.createInvoice({
      patientId: data.patientId,
      date: new Date(),
      dueDate,
      description: `Invoice for ${service.name}`,
      status: InvoiceStatus.PENDING,
      lines: [
        {
          serviceId: data.serviceId,
          quantity: 1,
          unitPrice: price,
          description: service.name,
        },
      ],
    });

    logger.info('Invoice generated', { invoiceId: invoice.id });
    return invoice;
  }

  static async processPayment(data: CreatePaymentData) {
    const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } });

    if (!invoice) {
      throw new CustomError('Invoice not found', 404);
    }

    const payment = await this.createPayment(data);

    const totalPaid = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });

    if ((totalPaid._sum.amount ?? 0) >= invoice.amount) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID },
      });
    }

    logger.info('Payment processed', { paymentId: payment.id });
    return payment;
  }
}

