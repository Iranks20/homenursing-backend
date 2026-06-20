import { Request, Response, NextFunction } from 'express';
import {
  PhysiotherapyService,
  CreateAssessmentData,
  CreateTreatmentPlanData,
  CreateSessionData,
} from '../services/physiotherapy.service';
import { CustomError } from '../middleware/error.middleware';

const requireParam = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new CustomError(`${name} is required`, 400);
  }
  return value;
};

const parsePage = (value: string | undefined, defaultValue = 1): number => {
  const parsed = value ? Number.parseInt(value, 10) : defaultValue;
  return Number.isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
};

const parseLimit = (value: string | undefined, defaultValue = 10): number => {
  const parsed = value ? Number.parseInt(value, 10) : defaultValue;
  return Number.isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
};

const requireBodyField = <T>(value: T | undefined, name: string): T => {
  if (value === undefined || value === null || value === '') {
    throw new CustomError(`${name} is required`, 400);
  }
  return value;
};

const ensureArray = <T>(value: unknown, name: string): T[] => {
  if (!Array.isArray(value)) {
    throw new CustomError(`${name} must be an array`, 400);
  }
  return value as T[];
};

export class PhysiotherapyController {
  // Assessments
  static async getAssessments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const page = parsePage(req.query.page as string | undefined);
      const limit = parseLimit(req.query.limit as string | undefined);
      const result = await PhysiotherapyService.getAssessments(patientId, page, limit);
      res.status(200).json({ success: true, data: result.assessments, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getAssessmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessmentId = requireParam(req.params.id, 'Assessment ID');
      const assessment = await PhysiotherapyService.getAssessmentById(assessmentId);
      if (!assessment) throw new CustomError('Assessment not found', 404);
      res.status(200).json({ success: true, data: assessment });
    } catch (error) {
      next(error);
    }
  }

  static async createAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Partial<CreateAssessmentData>;

      const payload: CreateAssessmentData = {
        patientId: requireBodyField(body.patientId, 'patientId'),
        specialistId: requireBodyField(body.specialistId, 'specialistId'),
        assessmentDate: requireBodyField(body.assessmentDate, 'assessmentDate'),
        chiefComplaint: requireBodyField(body.chiefComplaint, 'chiefComplaint'),
        history: requireBodyField(body.history, 'history'),
        examination: requireBodyField(body.examination, 'examination'),
        diagnosis: requireBodyField(body.diagnosis, 'diagnosis'),
        recommendations: requireBodyField(body.recommendations, 'recommendations'),
        injuryType: body.injuryType ?? undefined,
        affectedArea: Array.isArray(body.affectedArea) ? body.affectedArea : undefined,
        painScale:
          body.painScale !== undefined && body.painScale !== null
            ? Number(body.painScale)
            : undefined,
        mobilityLevel: body.mobilityLevel ?? undefined,
        functionalLimitations: Array.isArray(body.functionalLimitations)
          ? body.functionalLimitations
          : undefined,
        medicalHistory: body.medicalHistory ?? undefined,
        currentMedications: Array.isArray(body.currentMedications)
          ? body.currentMedications
          : undefined,
        assessmentNotes: body.assessmentNotes ?? undefined,
        goals: Array.isArray(body.goals) ? body.goals : undefined,
        nextAppointment: body.nextAppointment ?? undefined,
      };

      const assessment = await PhysiotherapyService.createAssessment(payload);
      res.status(201).json({ success: true, message: 'Assessment created successfully', data: assessment });
    } catch (error) {
      next(error);
    }
  }

  static async updateAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessmentId = requireParam(req.params.id, 'Assessment ID');
      const payload = req.body as Partial<CreateAssessmentData>;
      const assessment = await PhysiotherapyService.updateAssessment(assessmentId, payload);
      res.status(200).json({ success: true, message: 'Assessment updated successfully', data: assessment });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assessmentId = requireParam(req.params.id, 'Assessment ID');
      await PhysiotherapyService.deleteAssessment(assessmentId);
      res.status(200).json({ success: true, message: 'Assessment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Treatment Plans
  static async getTreatmentPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const page = parsePage(req.query.page as string | undefined);
      const limit = parseLimit(req.query.limit as string | undefined);
      const result = await PhysiotherapyService.getTreatmentPlans(patientId, page, limit);
      res.status(200).json({ success: true, data: result.treatmentPlans, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getTreatmentPlanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = requireParam(req.params.id, 'Treatment plan ID');
      const plan = await PhysiotherapyService.getTreatmentPlanById(planId);
      if (!plan) throw new CustomError('Treatment plan not found', 404);
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  static async createTreatmentPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Partial<CreateTreatmentPlanData>;

      const payload: CreateTreatmentPlanData = {
        patientId: requireBodyField(body.patientId, 'patientId'),
        assessmentId: requireBodyField(body.assessmentId, 'assessmentId'),
        specialistId: requireBodyField(body.specialistId, 'specialistId'),
        goals: ensureArray<string>(body.goals, 'goals') as any,
        exercises: ensureArray<unknown>(body.exercises, 'exercises'),
        modalities: ensureArray<unknown>(body.modalities, 'modalities'),
        duration: Number(requireBodyField(body.duration, 'duration')),
        frequency: requireBodyField(body.frequency, 'frequency'),
        planName: body.planName ?? undefined,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        status: body.status ?? undefined,
        progressNotes: body.progressNotes ?? undefined,
      };

      const plan = await PhysiotherapyService.createTreatmentPlan(payload);
      res.status(201).json({ success: true, message: 'Treatment plan created successfully', data: plan });
    } catch (error) {
      next(error);
    }
  }

  static async updateTreatmentPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = requireParam(req.params.id, 'Treatment plan ID');
      const payload = req.body as Partial<CreateTreatmentPlanData>;

      if (payload.goals && !Array.isArray(payload.goals)) {
        throw new CustomError('goals must be an array', 400);
      }
      if (payload.exercises && !Array.isArray(payload.exercises)) {
        throw new CustomError('exercises must be an array', 400);
      }
      if (payload.modalities && !Array.isArray(payload.modalities)) {
        throw new CustomError('modalities must be an array', 400);
      }

      const plan = await PhysiotherapyService.updateTreatmentPlan(planId, payload);
      res.status(200).json({ success: true, message: 'Treatment plan updated successfully', data: plan });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTreatmentPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = requireParam(req.params.id, 'Treatment plan ID');
      await PhysiotherapyService.deleteTreatmentPlan(planId);
      res.status(200).json({ success: true, message: 'Treatment plan deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Sessions
  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const treatmentPlanId = req.query.treatmentPlanId as string | undefined;
      const page = parsePage(req.query.page as string | undefined);
      const limit = parseLimit(req.query.limit as string | undefined);
      const result = await PhysiotherapyService.getSessions(patientId, treatmentPlanId, page, limit);
      res.status(200).json({ success: true, data: result.sessions, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = requireParam(req.params.id, 'Session ID');
      const session = await PhysiotherapyService.getSessionById(sessionId);
      if (!session) throw new CustomError('Session not found', 404);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as Partial<CreateSessionData>;

      const payload: CreateSessionData = {
        patientId: requireBodyField(body.patientId, 'patientId'),
        treatmentPlanId: requireBodyField(body.treatmentPlanId, 'treatmentPlanId'),
        specialistId: requireBodyField(body.specialistId, 'specialistId'),
        sessionDate: requireBodyField(body.sessionDate, 'sessionDate'),
        exercises: ensureArray<unknown>(body.exercises, 'exercises'),
        modalities: ensureArray<unknown>(body.modalities, 'modalities'),
        notes: requireBodyField(body.notes, 'notes'),
        duration: Number(requireBodyField(body.duration, 'duration')),
      } as CreateSessionData & {
        sessionTime?: string;
        painLevelBefore?: number;
        painLevelAfter?: number;
        functionalImprovement?: number;
        patientFeedback?: string;
        nextSessionDate?: string | null;
      };

      (payload as any).sessionTime = (body as any).sessionTime;
      (payload as any).painLevelBefore = (body as any).painLevelBefore;
      (payload as any).painLevelAfter = (body as any).painLevelAfter;
      (payload as any).functionalImprovement = (body as any).functionalImprovement;
      (payload as any).patientFeedback = (body as any).patientFeedback;
      (payload as any).nextSessionDate = (body as any).nextSessionDate;
      (payload as any).status = (body as any).status;

      const session = await PhysiotherapyService.createSession(payload);
      res.status(201).json({ success: true, message: 'Session created successfully', data: session });
    } catch (error) {
      next(error);
    }
  }

  static async updateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = requireParam(req.params.id, 'Session ID');
      const payload = req.body as Partial<CreateSessionData>;

      if (payload.exercises && !Array.isArray(payload.exercises)) {
        throw new CustomError('exercises must be an array', 400);
      }
      if (payload.modalities && !Array.isArray(payload.modalities)) {
        throw new CustomError('modalities must be an array', 400);
      }

      const session = await PhysiotherapyService.updateSession(sessionId, payload);
      res.status(200).json({ success: true, message: 'Session updated successfully', data: session });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = requireParam(req.params.id, 'Session ID');
      await PhysiotherapyService.deleteSession(sessionId);
      res.status(200).json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Exercises and Modalities
  static async getExercises(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercises = await PhysiotherapyService.getExercises();
      res.status(200).json({ success: true, data: exercises });
    } catch (error) {
      next(error);
    }
  }

  static async getModalities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modalities = await PhysiotherapyService.getModalities();
      res.status(200).json({ success: true, data: modalities });
    } catch (error) {
      next(error);
    }
  }
}

