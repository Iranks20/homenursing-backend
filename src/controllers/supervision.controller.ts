import { Request, Response, NextFunction } from 'express';
import { AssignmentStatus, NurseCoverageType } from '@prisma/client';
import SupervisionService from '../services/supervision.service';
import {
  assignNurseSchema,
  createReportSchema,
  listAssignmentsSchema,
  listReportsSchema,
  updateAssignmentSchema,
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
        coverageType?: NurseCoverageType;
        periodStart?: string | null;
        periodEnd?: string | null;
        scheduleNotes?: string | null;
      }>(assignNurseSchema, req.body);

      const payload: {
        patientId: string;
        nurseId: string;
        location?: string;
        notes?: string;
        assignedAt?: string;
        coverageType?: NurseCoverageType;
        periodStart?: string;
        periodEnd?: string;
        scheduleNotes?: string;
      } = {
        patientId: data.patientId,
        nurseId: data.nurseId,
      };
      if (data.location) payload.location = data.location;
      if (data.notes) payload.notes = data.notes;
      if (data.assignedAt) payload.assignedAt = data.assignedAt;
      if (data.coverageType) payload.coverageType = data.coverageType;
      if (data.periodStart) payload.periodStart = data.periodStart;
      if (data.periodEnd) payload.periodEnd = data.periodEnd;
      if (data.scheduleNotes) payload.scheduleNotes = data.scheduleNotes;

      const assignment = await SupervisionService.assignNurse(req.user!.userId, payload);
      res.status(201).json({ success: true, message: 'Nurse assigned to patient', data: assignment });
    } catch (error) {
      next(error);
    }
  }

  static async endAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignmentId = req.params.id;
      if (!assignmentId) {
        res.status(400).json({ success: false, message: 'Assignment ID is required' });
        return;
      }
      const assignment = await SupervisionService.endAssignment(req.user!.userId, assignmentId);
      res.status(200).json({ success: true, message: 'Assignment ended', data: assignment });
    } catch (error) {
      next(error);
    }
  }

  static async updateAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignmentId = req.params.id;
      if (!assignmentId) {
        res.status(400).json({ success: false, message: 'Assignment ID is required' });
        return;
      }

      const data = validateBody<{
        nurseId?: string;
        location?: string | null;
        notes?: string | null;
        assignedAt?: string;
        coverageType?: NurseCoverageType;
        periodStart?: string | null;
        periodEnd?: string | null;
        scheduleNotes?: string | null;
      }>(updateAssignmentSchema, req.body);

      const payload: {
        nurseId?: string;
        location?: string | null;
        notes?: string | null;
        assignedAt?: string;
        coverageType?: NurseCoverageType;
        periodStart?: string | null;
        periodEnd?: string | null;
        scheduleNotes?: string | null;
      } = {};

      if (data.nurseId !== undefined) payload.nurseId = data.nurseId;
      if (data.location !== undefined) payload.location = data.location;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.assignedAt !== undefined) payload.assignedAt = data.assignedAt;
      if (data.coverageType !== undefined) payload.coverageType = data.coverageType;
      if (data.periodStart !== undefined) payload.periodStart = data.periodStart;
      if (data.periodEnd !== undefined) payload.periodEnd = data.periodEnd;
      if (data.scheduleNotes !== undefined) payload.scheduleNotes = data.scheduleNotes;

      const assignment = await SupervisionService.updateAssignment(
        req.user!.userId,
        assignmentId,
        payload
      );
      res.status(200).json({ success: true, message: 'Assignment updated', data: assignment });
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
