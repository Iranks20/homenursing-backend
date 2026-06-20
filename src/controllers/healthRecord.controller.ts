import { Request, Response, NextFunction } from 'express';
import { RecordRole } from '@prisma/client';
import { HealthRecordService, HealthRecordFilters, CreateHealthRecordData } from '../services/healthRecord.service';
import { 
  validateBody, 
  validateQuery,
  createHealthRecordSchema, 
  updateHealthRecordSchema,
  searchHealthRecordsSchema,
} from '../validators/healthRecord.validator';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireParamId = (id: string | undefined, resource: string): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

const requireAuthUser = (req: Request): { id: string; email?: string; role?: string } => {
  const user = (req as Request & { user?: { id?: string; userId?: string; email?: string; role?: string } }).user;
  const userId = user?.id ?? user?.userId;
  if (!userId) {
     throw new CustomError('Unauthorized', 401);
   }
  const result: { id: string; email?: string; role?: string } = { id: userId };
  if (user?.email) result.email = user.email;
  if (user?.role) result.role = user.role;
  return result;
};

const toRecordRole = (role: string | undefined): RecordRole => {
  if (!role) {
    return RecordRole.NURSE;
  }
  const upper = role.toUpperCase() as keyof typeof RecordRole;
  return RecordRole[upper] ?? RecordRole.NURSE;
};

export class HealthRecordController {
  static async getHealthRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<HealthRecordFilters>(searchHealthRecordsSchema, req.query);
      const page = parseNumber(req.query.page, filters.page ?? 1);
      const limit = parseNumber(req.query.limit, filters.limit ?? 10);
      const role = req.user?.role?.toUpperCase();
      const specialistUserId = role === 'SPECIALIST' ? req.user!.userId : undefined;
      if (specialistUserId && filters.patientId) {
        await HealthRecordService.assertSpecialistAssignedToPatient(specialistUserId, filters.patientId);
      }
      const result = await HealthRecordService.getHealthRecords({
        ...filters,
        page,
        limit,
        ...(specialistUserId ? { restrictedToAssignedSpecialistId: specialistUserId } : {}),
      });

      res.status(200).json({
        success: true,
        data: result.records,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHealthRecordById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Health record');
      const record = await HealthRecordService.getHealthRecordById(id);

      if (!record) {
        throw new CustomError('Health record not found', 404);
      }

      const role = req.user?.role?.toUpperCase();
      if (role === 'SPECIALIST' && req.user) {
        const patient = (record as { patient?: { assignedSpecialistId?: string | null } }).patient;
        if (!patient || patient.assignedSpecialistId !== req.user.userId) {
          throw new CustomError('Access denied', 403);
        }
      }

      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireAuthUser(req);
      const data = validateBody<Omit<CreateHealthRecordData, 'updatedBy' | 'updatedByName' | 'updatedByRole'>>(createHealthRecordSchema, req.body);

      const specialistUserId = user.role?.toUpperCase() === 'SPECIALIST' ? user.id : undefined;
      const record = await HealthRecordService.createHealthRecord(
        {
          ...data,
          updatedBy: user.id,
          updatedByName: user.email ?? 'System',
          updatedByRole: toRecordRole(user.role),
        },
        specialistUserId ? { restrictSpecialistUserId: specialistUserId } : undefined
      );

      res.status(201).json({
        success: true,
        message: 'Health record created successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Health record');
      const data = validateBody(updateHealthRecordSchema, req.body) as Partial<CreateHealthRecordData> & { verified?: boolean; verifiedBy?: string };
      const user = requireAuthUser(req);
      const specialistUserId = user.role?.toUpperCase() === 'SPECIALIST' ? user.id : undefined;
      const record = await HealthRecordService.updateHealthRecord(id, data, {
        ...(specialistUserId ? { restrictSpecialistUserId: specialistUserId } : {}),
      });

      res.status(200).json({
        success: true,
        message: 'Health record updated successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Health record');
      const user = requireAuthUser(req);
      const specialistUserId = user.role?.toUpperCase() === 'SPECIALIST' ? user.id : undefined;
      await HealthRecordService.deleteHealthRecord(id, {
        ...(specialistUserId ? { restrictSpecialistUserId: specialistUserId } : {}),
      });

      res.status(200).json({
        success: true,
        message: 'Health record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientHealthRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const records = await HealthRecordService.getPatientHealthRecords(patientId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientVitals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const records = await HealthRecordService.getPatientVitals(patientId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientMedications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const records = await HealthRecordService.getPatientMedications(patientId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientSymptoms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const records = await HealthRecordService.getPatientSymptoms(patientId);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyHealthRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Health record');
      const user = requireAuthUser(req);
      const { notes } = req.body;
      const specialistUserId = user.role?.toUpperCase() === 'SPECIALIST' ? user.id : undefined;
      const record = await HealthRecordService.verifyHealthRecord(id, user.id, notes, {
        ...(specialistUserId ? { restrictSpecialistUserId: specialistUserId } : {}),
      });

      res.status(200).json({
        success: true,
        message: 'Health record verified successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportPatientHealthRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const exportData = await HealthRecordService.exportPatientHealthRecords(patientId);

      res.status(200).json({
        success: true,
        data: exportData,
      });
    } catch (error) {
      next(error);
    }
  }
}

