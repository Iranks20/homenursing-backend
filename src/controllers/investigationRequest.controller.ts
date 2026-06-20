import { Request, Response, NextFunction } from 'express';
import { Priority, InvestigationRequestStatus } from '@prisma/client';
import prisma from '../config/database';
import { InvestigationRequestService, CreateInvestigationRequestData, UpdateInvestigationRequestData, InvestigationRequestFilters } from '../services/investigationRequest.service';
import {
  validateBody,
  validateQuery,
  createInvestigationRequestSchema,
  updateInvestigationRequestSchema,
  listInvestigationRequestsQuerySchema,
} from '../validators/investigationRequest.validator';
import { CustomError } from '../middleware/error.middleware';

interface CreateInvestigationRequestBody {
  patientId: string;
  investigationName: string;
  priority?: string;
  notes?: string;
}

interface UpdateInvestigationRequestBody {
  status?: InvestigationRequestStatus;
  labSampleId?: string | null;
  completedById?: string | null;
  completedByName?: string | null;
  notes?: string | null;
}

interface ListInvestigationRequestsQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  status?: string;
  requestedById?: string;
}

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) throw new CustomError('Authentication required', 401);
  return userId;
};

export class InvestigationRequestController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const body = validateBody<CreateInvestigationRequestBody>(createInvestigationRequestSchema, req.body as unknown);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
      if (!user) throw new CustomError('User not found', 404);
      const role = user.role;
      const data: CreateInvestigationRequestData = {
        patientId: body.patientId,
        requestedById: userId,
        requestedByName: user.name,
        requestedByRole: role,
        investigationName: body.investigationName,
        priority: (body.priority as Priority) ?? Priority.ROUTINE,
      };
      if (body.notes !== undefined && body.notes !== '') {
        data.notes = body.notes;
      }
      const request = await InvestigationRequestService.create(data);
      res.status(201).json({ success: true, data: request });
    } catch (e) {
      next(e);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = validateQuery<ListInvestigationRequestsQuery>(listInvestigationRequestsQuerySchema, req.query as unknown);
      const filters: InvestigationRequestFilters = {};
      if (query.page !== undefined) filters.page = query.page;
      if (query.limit !== undefined) filters.limit = query.limit;
      if (query.patientId !== undefined && query.patientId !== '') filters.patientId = query.patientId;
      if (query.requestedById !== undefined && query.requestedById !== '') filters.requestedById = query.requestedById;
      const statusVal = query.status;
      if (statusVal !== undefined && statusVal !== '') {
        filters.status = statusVal as InvestigationRequestStatus;
      }
      const result = await InvestigationRequestService.list(filters);
      res.status(200).json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) throw new CustomError('Request ID is required', 400);
      const request = await InvestigationRequestService.getById(id);
      res.status(200).json({ success: true, data: request });
    } catch (e) {
      next(e);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id) throw new CustomError('Request ID is required', 400);
      const body = validateBody<UpdateInvestigationRequestBody>(updateInvestigationRequestSchema, req.body as unknown);
      const userId = requireUserId(req);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const data: UpdateInvestigationRequestData = {};
      const status = body.status;
      if (status !== undefined) data.status = status;
      if (body.labSampleId != null && body.labSampleId !== '') data.labSampleId = body.labSampleId;
      if (body.notes != null && body.notes !== '') data.notes = body.notes;
      if (status === InvestigationRequestStatus.COMPLETED && user?.name) {
        data.completedById = userId;
        data.completedByName = user.name;
      }
      const updated = await InvestigationRequestService.update(id, data);
      res.status(200).json({ success: true, data: updated });
    } catch (e) {
      next(e);
    }
  }
}
