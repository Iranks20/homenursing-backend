import { Request, Response, NextFunction } from 'express';
import { PatientStatus } from '@prisma/client';
import { PatientService, PatientFilters, CreatePatientData, UpdatePatientData } from '../services/patient.service';
import { 
  validateBody, 
  validateQuery,
  createPatientSchema, 
  updatePatientSchema,
  updatePatientStatusSchema,
  searchPatientsSchema,
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  createProgressRecordSchema,
  updateProgressRecordSchema,
  createPatientCaseSchema,
  logCaseVisitSchema,
} from '../validators/patient.validator';
import { logger } from '../utils/logger';
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

export class PatientController {
  /**
   * Get all patients
   * GET /api/v1/patients
   * Role-based access: Filters patients based on user role
   */
  static async getPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<PatientFilters>(searchPatientsSchema, req.query);
      
      // Add role-based filtering from authenticated user
      // Normalize role to uppercase for consistent comparison
      if (req.user) {
        filters.userRole = typeof req.user.role === 'string' ? req.user.role.toUpperCase() : req.user.role;
        filters.userId = req.user.userId;
        logger.debug('Applying role-based patient filtering', { 
          userId: req.user.userId, 
          role: filters.userRole 
        });
        // Biller and admin need consultation fees for assignment-based billing
        if (filters.userRole === 'BILLER' || filters.userRole === 'ADMIN') {
          filters.includeConsultationFees = true;
        }
      }
      
      const result = await PatientService.getPatients(filters);

      res.status(200).json({
        success: true,
        data: result.patients,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get patient by ID
   * GET /api/v1/patients/:id
   * Role-based access: Verifies user has access to this patient
   */
  static async getPatientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const patient = await PatientService.getPatientById(id);

      if (!patient) {
        throw new CustomError('Patient not found', 404);
      }

      // Role-based access control
      if (req.user) {
        const userRole = typeof req.user.role === 'string' ? req.user.role.toUpperCase() : req.user.role;
        const userId = req.user.userId;
        
        // Admin, Receptionist, and Nurse can access all patients
        if (userRole !== 'ADMIN' && userRole !== 'RECEPTIONIST' && userRole !== 'NURSE') {
          // Specialist: must be assigned to this patient (formerly DOCTOR)
          if (userRole === 'SPECIALIST' && patient.assignedSpecialistId !== userId) {
            logger.warn('Access denied - Specialist trying to access unassigned patient', { 
              userId, 
              patientId: id, 
              assignedSpecialistId: patient.assignedSpecialistId 
            });
            throw new CustomError('Access denied - patient not assigned to you', 403);
          }
          // Therapist: must be assigned to this patient (formerly referredSpecialistId)
          if (userRole === 'THERAPIST' && patient.assignedTherapistId !== userId) {
            logger.warn('Access denied - Therapist trying to access unassigned patient', { 
              userId, 
              patientId: id, 
              assignedTherapistId: patient.assignedTherapistId 
            });
            throw new CustomError('Access denied - patient not assigned to you', 403);
          }
        }
        // Nurse can access all patients (no restriction)
      }

      res.status(200).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new patient
   * POST /api/v1/patients
   */
  static async createPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = validateBody<CreatePatientData & { medicalHistory?: string }>(createPatientSchema, req.body);
      // Map medicalHistory to medicalHistoryNotes
      const data: CreatePatientData = {
        ...validatedData,
        medicalHistoryNotes: (validatedData as any).medicalHistory || validatedData.medicalHistoryNotes,
        ...(validatedData.serviceIds !== undefined && { serviceIds: validatedData.serviceIds }),
      };
      delete (data as any).medicalHistory;
      const patient = await PatientService.createPatient(data);

      res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update patient
   * PUT /api/v1/patients/:id
   */
  static async updatePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      // Normalize empty strings to null so optional email/condition pass validation and can clear in DB
      const body = { ...req.body } as Record<string, unknown>;
      if (body.email === '' || body.email === null) body.email = null;
      if (body.condition === '' || body.condition === null) body.condition = null;
      const validatedData = validateBody<UpdatePatientData & { medicalHistory?: string }>(updatePatientSchema, body);
      // Map medicalHistory to medicalHistoryNotes
      const data: UpdatePatientData = {
        ...validatedData,
        medicalHistoryNotes: (validatedData as any).medicalHistory !== undefined 
          ? (validatedData as any).medicalHistory 
          : validatedData.medicalHistoryNotes,
        ...(validatedData.serviceIds !== undefined && { serviceIds: validatedData.serviceIds }),
      };
      delete (data as any).medicalHistory;
      const patient = await PatientService.updatePatient(id, data);

      res.status(200).json({
        success: true,
        message: 'Patient updated successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update patient status
   * PATCH /api/v1/patients/:id/status
   */
  static async updatePatientStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const { status } = validateBody<{ status: string }>(updatePatientStatusSchema, req.body);
      const normalizedStatus = status.toUpperCase() as keyof typeof PatientStatus;
      if (!(normalizedStatus in PatientStatus)) {
        throw new CustomError('Invalid status', 400);
      }
      const patient = await PatientService.updatePatientStatus(id, PatientStatus[normalizedStatus]);

      res.status(200).json({
        success: true,
        message: 'Patient status updated successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete patient
   * DELETE /api/v1/patients/:id
   */
  static async deletePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      await PatientService.deletePatient(id);

      res.status(200).json({
        success: true,
        message: 'Patient deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search patients
   * GET /api/v1/patients/search
   * Role-based access: Filters patients based on user role
   */
  static async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<PatientFilters>(searchPatientsSchema, req.query);
      
      // Add role-based filtering from authenticated user
      if (req.user) {
        filters.userRole = req.user.role;
        filters.userId = req.user.userId;
      }
      
      const result = await PatientService.searchPatients(filters);

      res.status(200).json({
        success: true,
        data: result.patients,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get patient dashboard
   * GET /api/v1/patients/:id/dashboard
   */
  static async getPatientDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const dashboard = await PatientService.getPatientDashboard(id);

      res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get patient timeline
   * GET /api/v1/patients/:id/timeline
   */
  static async getPatientTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 20);
      
      const result = await PatientService.getPatientTimeline(id, page, limit);

      res.status(200).json({
        success: true,
        data: result.timeline,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // Medical Records
  static async getMedicalHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const records = await PatientService.getMedicalHistory(id);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const data = validateBody(createMedicalRecordSchema, req.body);
      const record = await PatientService.addMedicalRecord(id, data);

      res.status(201).json({
        success: true,
        message: 'Medical record added successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const recordId = requireParamId(req.params.recordId, 'Record');
      const data = validateBody(updateMedicalRecordSchema, req.body);
      const record = await PatientService.updateMedicalRecord(id, recordId, data);

      res.status(200).json({
        success: true,
        message: 'Medical record updated successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMedicalRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const recordId = requireParamId(req.params.recordId, 'Record');
      await PatientService.deleteMedicalRecord(id, recordId);

      res.status(200).json({
        success: true,
        message: 'Medical record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Progress Records
  static async getProgressRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const records = await PatientService.getProgressRecords(id);

      res.status(200).json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addProgressRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const data = validateBody(createProgressRecordSchema, req.body);
      const record = await PatientService.addProgressRecord(id, data);

      res.status(201).json({
        success: true,
        message: 'Progress record added successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProgressRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const recordId = requireParamId(req.params.recordId, 'Record');
      const data = validateBody(updateProgressRecordSchema, req.body);
      const record = await PatientService.updateProgressRecord(id, recordId, data);

      res.status(200).json({
        success: true,
        message: 'Progress record updated successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProgressRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const recordId = requireParamId(req.params.recordId, 'Record');
      await PatientService.deleteProgressRecord(id, recordId);

      res.status(200).json({
        success: true,
        message: 'Progress record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Patient Cases
  static async getPatientCases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const cases = await PatientService.getPatientCases(id);

      res.status(200).json({
        success: true,
        data: cases,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPatientCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const data = validateBody(createPatientCaseSchema, req.body);
      const case_ = await PatientService.createPatientCase(id, data);

      res.status(201).json({
        success: true,
        message: 'Patient case created successfully',
        data: case_,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePatientCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const caseId = requireParamId(req.params.caseId, 'Case');
      const case_ = await PatientService.updatePatientCase(id, caseId, req.body);

      res.status(200).json({
        success: true,
        message: 'Patient case updated successfully',
        data: case_,
      });
    } catch (error) {
      next(error);
    }
  }

  static async closePatientCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const caseId = requireParamId(req.params.caseId, 'Case');
      const case_ = await PatientService.closePatientCase(id, caseId);

      res.status(200).json({
        success: true,
        message: 'Patient case closed successfully',
        data: case_,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logCaseVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const caseId = requireParamId(req.params.caseId, 'Case');
      const performedBy = (req as any).user?.userId as string | undefined;
      const { details } = validateBody<{ details?: string | null }>(logCaseVisitSchema, req.body ?? {});
      const case_ = await PatientService.logCaseVisit(id, caseId, performedBy, details ?? undefined);

      res.status(200).json({
        success: true,
        message: 'Visit logged successfully',
        data: case_,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Merge duplicate patient records
   * POST /api/v1/patients/:id/merge
   */
  static async mergePatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const { duplicatePatientId } = req.body as { duplicatePatientId?: string };
      
      if (!duplicatePatientId) {
        throw new CustomError('duplicatePatientId is required', 400);
      }

      const patient = await PatientService.mergePatients(id, duplicatePatientId);

      res.status(200).json({
        success: true,
        message: 'Patients merged successfully',
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProgressAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const analytics = await PatientService.getProgressAnalytics(id);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getCaseEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const caseId = requireParamId(req.params.caseId, 'Case');
      const events = await PatientService.getCaseEvents(id, caseId);
      res.status(200).json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  static async exportMedicalHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Patient');
      const exportData = await PatientService.exportMedicalHistory(id);
      res.status(200).json({ success: true, data: exportData });
    } catch (error) {
      next(error);
    }
  }
}

