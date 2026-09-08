import { Prisma, Visitor } from '@prisma/client';
import prisma from '../config/database';
import { CustomError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export interface CreateVisitorData {
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  purpose?: string | null;
  notes?: string | null;
  visitedAt?: Date | string | null;
  isActive?: boolean;
}

export type UpdateVisitorData = Partial<CreateVisitorData>;

const toOptionalString = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const toVisitedAt = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError('visitedAt is invalid', 400);
  }
  return date;
};

export class VisitorService {
  static async createVisitor(data: CreateVisitorData): Promise<Visitor> {
    const name = data.name.trim();
    const phone = data.phone.trim();
    if (!name) throw new CustomError('name is required', 400);
    if (!phone) throw new CustomError('phone is required', 400);

    const createData: Prisma.VisitorCreateInput = {
      name,
      phone,
      isActive: data.isActive ?? true,
    };
    const email = toOptionalString(data.email);
    if (email !== undefined) createData.email = email;
    const company = toOptionalString(data.company);
    if (company !== undefined) createData.company = company;
    const purpose = toOptionalString(data.purpose);
    if (purpose !== undefined) createData.purpose = purpose;
    const notes = toOptionalString(data.notes);
    if (notes !== undefined) createData.notes = notes;
    const visitedAt = toVisitedAt(data.visitedAt);
    if (visitedAt !== undefined) createData.visitedAt = visitedAt;

    const visitor = await prisma.visitor.create({ data: createData });
    logger.info('Visitor created', { visitorId: visitor.id });
    return visitor;
  }

  static async getVisitorById(id: string): Promise<Visitor | null> {
    return prisma.visitor.findUnique({ where: { id } });
  }

  static async getVisitors(params: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
  } = {}) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = (page - 1) * limit;
    const search = (params.search ?? '').trim();

    const where: Prisma.VisitorWhereInput = {};
    if (!params.includeInactive) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [visitors, total] = await Promise.all([
      prisma.visitor.findMany({
        where,
        orderBy: [{ visitedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.visitor.count({ where }),
    ]);

    return {
      visitors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  static async updateVisitor(id: string, data: UpdateVisitorData): Promise<Visitor> {
    const existing = await prisma.visitor.findUnique({ where: { id } });
    if (!existing) throw new CustomError('Visitor not found', 404);

    const updates: Prisma.VisitorUpdateInput = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new CustomError('name is required', 400);
      updates.name = name;
    }
    if (data.phone !== undefined) {
      const phone = data.phone.trim();
      if (!phone) throw new CustomError('phone is required', 400);
      updates.phone = phone;
    }
    if (data.email !== undefined) updates.email = toOptionalString(data.email) ?? null;
    if (data.company !== undefined) updates.company = toOptionalString(data.company) ?? null;
    if (data.purpose !== undefined) updates.purpose = toOptionalString(data.purpose) ?? null;
    if (data.notes !== undefined) updates.notes = toOptionalString(data.notes) ?? null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.visitedAt !== undefined) {
      const visitedAt = toVisitedAt(data.visitedAt);
      if (visitedAt !== undefined) updates.visitedAt = visitedAt;
    }

    const visitor = await prisma.visitor.update({ where: { id }, data: updates });
    logger.info('Visitor updated', { visitorId: visitor.id });
    return visitor;
  }

  static async deleteVisitor(id: string): Promise<void> {
    const existing = await prisma.visitor.findUnique({ where: { id } });
    if (!existing) throw new CustomError('Visitor not found', 404);
    await prisma.visitor.update({
      where: { id },
      data: { isActive: false },
    });
    logger.info('Visitor deactivated', { visitorId: id });
  }
}
