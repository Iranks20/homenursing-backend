import { Request, Response, NextFunction } from 'express';
import { AssignmentStatus } from '@prisma/client';
import SupervisionService from '../services/supervision.service';
import {
  assignNurseSchema,
  createReportSchema,
  listAssignmentsSchema,
  listReportsSchema,
} from '../validators/supervision.validator';
import { validateBody, validateQuery } from '../validators/user.validator';

export class SupervisionController {
  static async assignNurse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<{
        patientId: string;
        nurseId: string;
        location?: string | null;
        notes?: string | null;
        assignedAt?: string;
      }>(assignNurseSchema, req.body);

      const payload: {
        patientId: string;
        nurseId: string;
        location?: string;
        notes?: string;
        assignedAt?: string;
      } = {
        patientId: data.patientId,
        nurseId: data.nurseId,
      };
      if (data.location) payload.location = data.location;
      if (data.notes) payload.notes = data.notes;
      if (data.assignedAt) payload.assignedAt = data.assignedAt;

      const assignment = await SupervisionService.assignNurse(req.user!.userId, payload);
      res.status(201).json({ success: true, message: 'Nurse assigned to patient', data: assignment });
    } catch (error) {
      next(error);
    }
  }

  static async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<{
        nurseId?: string;
        patientId?: string;
        status?: AssignmentStatus;
        page?: number;
        limit?: number;
      }>(listAssignmentsSchema, req.query);

      const result = await SupervisionService.listAssignments(filters);
      res.status(200).json({ success: true, data: result.assignments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<{
        nurseId: string;
        patientId?: string | null;
        title: string;
        content: string;
        visitDate?: string | null;
      }>(createReportSchema, req.body);

      const payload: {
        nurseId: string;
        patientId?: string;
        title: string;
        content: string;
        visitDate?: string;
      } = {
        nurseId: data.nurseId,
        title: data.title,
        content: data.content,
      };
      if (data.patientId) payload.patientId = data.patientId;
      if (data.visitDate) payload.visitDate = data.visitDate;

      const report = await SupervisionService.createReport(req.user!.userId, payload);
      res.status(201).json({ success: true, message: 'Supervision report saved', data: report });
    } catch (error) {
      next(error);
    }
  }

  static async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<{
        nurseId?: string;
        patientId?: string;
        page?: number;
        limit?: number;
      }>(listReportsSchema, req.query);

      const role = req.user!.role.toUpperCase();
      const listFilters: {
        nurseId?: string;
        patientId?: string;
        supervisorId?: string;
        page?: number;
        limit?: number;
      } = { ...filters };

      if (role === 'SUPERVISOR') {
        listFilters.supervisorId = req.user!.userId;
      }

      const result = await SupervisionService.listReports(listFilters);
      res.status(200).json({ success: true, data: result.reports, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }
}

export default SupervisionController;
