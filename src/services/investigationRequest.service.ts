import { Prisma, InvestigationRequestStatus, Priority } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

const includePatient = { patient: { select: { id: true, name: true, email: true } } } as const;

export interface CreateInvestigationRequestData {
  patientId: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  investigationName: string;
  priority?: Priority;
  notes?: string;
}

export interface UpdateInvestigationRequestData {
  status?: InvestigationRequestStatus;
  labSampleId?: string;
  completedById?: string;
  completedByName?: string;
  notes?: string;
}

export interface InvestigationRequestFilters {
  patientId?: string;
  status?: InvestigationRequestStatus;
  requestedById?: string;
  page?: number;
  limit?: number;
}

export class InvestigationRequestService {
  static async create(data: CreateInvestigationRequestData) {
    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }
    const createData: Prisma.InvestigationRequestUncheckedCreateInput = {
      patientId: data.patientId,
      requestedById: data.requestedById,
      requestedByName: data.requestedByName,
      requestedByRole: data.requestedByRole,
      investigationName: data.investigationName.trim(),
      priority: data.priority ?? Priority.ROUTINE,
    };
    if (data.notes !== undefined && data.notes !== '') {
      createData.notes = data.notes;
    }
    const request = await prisma.investigationRequest.create({
      data: createData,
      include: includePatient,
    });
    logger.info('Investigation request created', { requestId: request.id, patientId: data.patientId });
    return request;
  }

  static async list(filters: InvestigationRequestFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;
    const where: Prisma.InvestigationRequestWhereInput = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    if (filters.requestedById) where.requestedById = filters.requestedById;

    const [requests, total] = await Promise.all([
      prisma.investigationRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: includePatient,
      }),
      prisma.investigationRequest.count({ where }),
    ]);
    return {
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  static async getById(id: string) {
    const request = await prisma.investigationRequest.findUnique({
      where: { id },
      include: includePatient,
    });
    if (!request) {
      throw new CustomError('Investigation request not found', 404);
    }
    return request;
  }

  static async update(id: string, data: UpdateInvestigationRequestData) {
    const existing = await prisma.investigationRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Investigation request not found', 404);
    }
    const updateData: Prisma.InvestigationRequestUncheckedUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.labSampleId !== undefined) updateData.labSampleId = data.labSampleId;
    if (data.completedById !== undefined) updateData.completedById = data.completedById;
    if (data.completedByName !== undefined) updateData.completedByName = data.completedByName;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status === InvestigationRequestStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    const updated = await prisma.investigationRequest.update({
      where: { id },
      data: updateData,
      include: includePatient,
    });
    logger.info('Investigation request updated', { requestId: id, status: data.status });
    return updated;
  }
}
