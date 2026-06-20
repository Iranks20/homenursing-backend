import { Prisma, SystemConfig } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';

type ISODateString = string;

type JsonObject = Prisma.JsonObject;

type ExercisesPayload = unknown[];

type ModalitiesPayload = unknown[];

type GoalsPayload = Prisma.JsonArray;

const ASSESSMENT_KEY_PREFIX = 'physio_assessment_';
const TREATMENT_PLAN_KEY_PREFIX = 'physio_treatment_plan_';
const SESSION_KEY_PREFIX = 'physio_session_';

const ASSESSMENT_CATEGORY = 'physiotherapy_assessment';
const TREATMENT_PLAN_CATEGORY = 'physiotherapy_treatment_plan';
const SESSION_CATEGORY = 'physiotherapy_session';

export interface CreateAssessmentData {
  patientId: string;
  specialistId: string;
  assessmentDate: ISODateString;
  chiefComplaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  recommendations: string;
  // Extended fields mapped from frontend Assessment modal so each field is stored separately
  injuryType?: string | undefined;
  affectedArea?: string[] | undefined;
  painScale?: number | undefined;
  mobilityLevel?: string | undefined;
  functionalLimitations?: string[] | undefined;
  medicalHistory?: string | undefined;
  currentMedications?: string[] | undefined;
  assessmentNotes?: string | undefined;
  goals?: string[] | undefined;
  nextAppointment?: ISODateString | undefined;
}

export interface CreateTreatmentPlanData {
  patientId: string;
  assessmentId: string;
  specialistId: string;
  goals: GoalsPayload;
  exercises: ExercisesPayload;
  modalities: ModalitiesPayload;
  duration: number;
  frequency: string;
  // Optional extended fields mapped from frontend TreatmentPlan modal
  planName?: string | undefined;
  startDate?: ISODateString | undefined;
  endDate?: ISODateString | null | undefined;
  status?: string | undefined;
  progressNotes?: string | undefined;
}

export interface CreateSessionData {
  patientId: string;
  treatmentPlanId: string;
  specialistId: string;
  sessionDate: ISODateString;
  exercises: ExercisesPayload;
  modalities: ModalitiesPayload;
  notes: string;
  duration: number;
  status?: string | undefined;
}

export interface AssessmentRecord extends CreateAssessmentData {
  id: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  patientName?: string;
  physiotherapistName?: string;
  patient?: { id: string; name: string };
  specialist?: { id: string; name: string };
}

export interface TreatmentPlanRecord extends CreateTreatmentPlanData {
  id: string;
  status: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  patientName?: string | undefined;
  physiotherapistName?: string | undefined;
  patient?: { id: string; name: string };
  specialist?: { id: string; name: string };
}

export interface SessionRecord extends CreateSessionData {
  id: string;
  status: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  // Extended session fields mirrored from stored JSON
  sessionTime?: string;
  painLevelBefore?: number;
  painLevelAfter?: number;
  functionalImprovement?: number;
  patientFeedback?: string;
  nextSessionDate?: ISODateString | null;
  patientName?: string | undefined;
  physiotherapistName?: string | undefined;
  patient?: { id: string; name: string };
  specialist?: { id: string; name: string };
}

const toJsonObject = (value: Prisma.JsonValue): JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return undefined;
};

const formatAssessment = (record: SystemConfig): AssessmentRecord | null => {
  if (!record.key.startsWith(ASSESSMENT_KEY_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const assessment: AssessmentRecord = {
    id: record.id,
    patientId: String(value.patientId ?? ''),
    specialistId: String(value.specialistId ?? ''),
    assessmentDate: String(value.assessmentDate ?? ''),
    chiefComplaint: String(value.chiefComplaint ?? ''),
    history: String(value.history ?? ''),
    examination: String(value.examination ?? ''),
    diagnosis: String(value.diagnosis ?? ''),
    recommendations: String(value.recommendations ?? ''),
    injuryType: typeof value.injuryType === 'string' ? value.injuryType : undefined,
    affectedArea: Array.isArray(value.affectedArea)
      ? (value.affectedArea as string[])
      : undefined,
    painScale:
      typeof value.painScale === 'number'
        ? value.painScale
        : value.painScale !== undefined
        ? Number(value.painScale) || 0
        : undefined,
    mobilityLevel: typeof value.mobilityLevel === 'string' ? value.mobilityLevel : undefined,
    functionalLimitations: Array.isArray(value.functionalLimitations)
      ? (value.functionalLimitations as string[])
      : undefined,
    medicalHistory: typeof value.medicalHistory === 'string' ? value.medicalHistory : undefined,
    currentMedications: Array.isArray(value.currentMedications)
      ? (value.currentMedications as string[])
      : undefined,
    assessmentNotes: typeof value.assessmentNotes === 'string' ? value.assessmentNotes : undefined,
    createdAt: String(value.createdAt ?? new Date().toISOString()),
  };

  if (typeof value.updatedAt === 'string') {
    assessment.updatedAt = value.updatedAt;
  }

  // Parse goals if stored as array
  if (Array.isArray(value.goals)) {
    assessment.goals = value.goals.map(g => String(g));
  }

  // Parse nextAppointment if stored
  if (value.nextAppointment) {
    assessment.nextAppointment = String(value.nextAppointment);
  }

  return assessment;
};

const formatTreatmentPlan = (record: SystemConfig): TreatmentPlanRecord | null => {
  if (!record.key.startsWith(TREATMENT_PLAN_KEY_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const plan: TreatmentPlanRecord = {
    id: record.id,
    patientId: String(value.patientId ?? ''),
    assessmentId: String(value.assessmentId ?? ''),
    specialistId: String(value.specialistId ?? ''),
    goals: Array.isArray(value.goals) ? (value.goals as GoalsPayload) : ([] as GoalsPayload),
    exercises: Array.isArray(value.exercises) ? (value.exercises as ExercisesPayload) : ([] as ExercisesPayload),
    modalities: Array.isArray(value.modalities) ? (value.modalities as ModalitiesPayload) : ([] as ModalitiesPayload),
    duration: Number(value.duration ?? 0),
    frequency: String(value.frequency ?? ''),
    status: String(value.status ?? 'active'),
    createdAt: String(value.createdAt ?? new Date().toISOString()),
  };

  if (typeof value.planName === 'string') {
    (plan as any).planName = value.planName;
  }
  if (typeof value.startDate === 'string') {
    (plan as any).startDate = value.startDate;
  }
  if (typeof value.endDate === 'string' || value.endDate === null) {
    (plan as any).endDate = value.endDate as string | null;
  }
  if (typeof value.progressNotes === 'string') {
    (plan as any).progressNotes = value.progressNotes;
  }

  if (typeof value.updatedAt === 'string') {
    plan.updatedAt = value.updatedAt;
  }

  return plan;
};

const formatSession = (record: SystemConfig): SessionRecord | null => {
  if (!record.key.startsWith(SESSION_KEY_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const session: SessionRecord = {
    id: record.id,
    patientId: String(value.patientId ?? ''),
    treatmentPlanId: String(value.treatmentPlanId ?? ''),
    specialistId: String(value.specialistId ?? ''),
    sessionDate: String(value.sessionDate ?? ''),
    exercises: Array.isArray(value.exercises) ? (value.exercises as ExercisesPayload) : ([] as ExercisesPayload),
    modalities: Array.isArray(value.modalities) ? (value.modalities as ModalitiesPayload) : ([] as ModalitiesPayload),
    notes: String(value.notes ?? ''),
    duration: Number(value.duration ?? 0),
    status: String(value.status ?? 'completed'),
    createdAt: String(value.createdAt ?? new Date().toISOString()),
  };

  if (typeof value.sessionTime === 'string') {
    (session as any).sessionTime = value.sessionTime;
  }
  if (typeof value.painLevelBefore === 'number') {
    (session as any).painLevelBefore = value.painLevelBefore;
  }
  if (typeof value.painLevelAfter === 'number') {
    (session as any).painLevelAfter = value.painLevelAfter;
  }
  if (typeof value.functionalImprovement === 'number') {
    (session as any).functionalImprovement = value.functionalImprovement;
  }
  if (typeof value.patientFeedback === 'string') {
    (session as any).patientFeedback = value.patientFeedback;
  }
  if (typeof value.nextSessionDate === 'string' || value.nextSessionDate === null) {
    (session as any).nextSessionDate = value.nextSessionDate as string | null;
  }

  if (typeof value.updatedAt === 'string') {
    session.updatedAt = value.updatedAt;
  }

  return session;
};

const buildAssessmentValue = (data: CreateAssessmentData): JsonObject => {
  const value: Record<string, unknown> = {
    patientId: data.patientId,
    specialistId: data.specialistId,
    assessmentDate: new Date(data.assessmentDate).toISOString(),
    chiefComplaint: data.chiefComplaint,
    history: data.history,
    examination: data.examination,
    diagnosis: data.diagnosis,
    recommendations: data.recommendations,
    createdAt: new Date().toISOString(),
  };

  // Add optional fields if provided
  if (data.injuryType) {
    value.injuryType = data.injuryType;
  }

  if (data.affectedArea && Array.isArray(data.affectedArea) && data.affectedArea.length > 0) {
    value.affectedArea = data.affectedArea;
  }

  if (typeof data.painScale === 'number') {
    value.painScale = data.painScale;
  }

  if (data.mobilityLevel) {
    value.mobilityLevel = data.mobilityLevel;
  }

  if (
    data.functionalLimitations &&
    Array.isArray(data.functionalLimitations) &&
    data.functionalLimitations.length > 0
  ) {
    value.functionalLimitations = data.functionalLimitations;
  }

  if (typeof data.medicalHistory === 'string') {
    value.medicalHistory = data.medicalHistory;
  }

  if (
    data.currentMedications &&
    Array.isArray(data.currentMedications) &&
    data.currentMedications.length > 0
  ) {
    value.currentMedications = data.currentMedications;
  }

  if (typeof data.assessmentNotes === 'string') {
    value.assessmentNotes = data.assessmentNotes;
  }

  if (data.goals && Array.isArray(data.goals) && data.goals.length > 0) {
    value.goals = data.goals;
  }

  if (data.nextAppointment) {
    value.nextAppointment = new Date(data.nextAppointment).toISOString();
  }

  return value as JsonObject;
};

const buildTreatmentPlanValue = (data: CreateTreatmentPlanData): JsonObject => {
  const value: Record<string, unknown> = {
    patientId: data.patientId,
    assessmentId: data.assessmentId,
    specialistId: data.specialistId,
    goals: data.goals as Prisma.JsonArray,
    exercises: data.exercises as Prisma.JsonArray,
    modalities: data.modalities as Prisma.JsonArray,
    duration: data.duration,
    frequency: data.frequency,
    status: data.status ?? 'active',
    createdAt: new Date().toISOString(),
  };

  if (data.planName) {
    value.planName = data.planName;
  }
  if (data.startDate) {
    value.startDate = new Date(data.startDate).toISOString();
  }
  if (data.endDate !== undefined) {
    value.endDate = data.endDate ? new Date(data.endDate).toISOString() : null;
  }
  if (typeof data.progressNotes === 'string') {
    value.progressNotes = data.progressNotes;
  }

  return value as JsonObject;
};

const buildSessionValue = (data: CreateSessionData): JsonObject => {
  const value: Record<string, unknown> = {
    patientId: data.patientId,
    treatmentPlanId: data.treatmentPlanId,
    specialistId: data.specialistId,
    sessionDate: new Date(data.sessionDate).toISOString(),
    exercises: data.exercises as Prisma.JsonArray,
    modalities: data.modalities as Prisma.JsonArray,
    notes: data.notes,
    duration: data.duration,
    status: (data as any).status ?? 'completed',
    createdAt: new Date().toISOString(),
  };

  if ((data as any).sessionTime) {
    value.sessionTime = (data as any).sessionTime;
  }
  if ((data as any).painLevelBefore !== undefined) {
    value.painLevelBefore = (data as any).painLevelBefore;
  }
  if ((data as any).painLevelAfter !== undefined) {
    value.painLevelAfter = (data as any).painLevelAfter;
  }
  if ((data as any).functionalImprovement !== undefined) {
    value.functionalImprovement = (data as any).functionalImprovement;
  }
  if ((data as any).patientFeedback !== undefined) {
    value.patientFeedback = (data as any).patientFeedback;
  }
  if ((data as any).nextSessionDate !== undefined) {
    const next = (data as any).nextSessionDate;
    value.nextSessionDate = next ? new Date(next).toISOString() : null;
  }

  return value as JsonObject;
};

const buildWhere = (prefix: string, filters: Array<Prisma.SystemConfigWhereInput>): Prisma.SystemConfigWhereInput => {
  const conditions: Prisma.SystemConfigWhereInput[] = [{ key: { startsWith: prefix } }, ...filters];
  if (conditions.length === 1) {
    return conditions[0]!;
  }
  return { AND: conditions };
};

const jsonEquals = (path: string, value: string): Prisma.SystemConfigWhereInput => ({
  value: { path: [path], equals: value } as Prisma.JsonFilter,
});

const mergeUpdate = (current: JsonObject, updates: JsonObject): JsonObject => ({
  ...current,
  ...updates,
  updatedAt: new Date().toISOString(),
});

export class PhysiotherapyService {
  // Assessments
  static async createAssessment(data: CreateAssessmentData): Promise<AssessmentRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${ASSESSMENT_KEY_PREFIX}${Date.now()}`,
        category: ASSESSMENT_CATEGORY,
        value: buildAssessmentValue(data),
      },
    });

    logger.info('Physiotherapy assessment created', { assessmentId: record.id });
    const formatted = formatAssessment(record);
    if (!formatted) {
      throw new Error('Failed to create assessment');
    }

    // Enrich with patient and specialist names
    const [patient, specialist] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: formatted.patientId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: formatted.specialistId },
        select: { id: true, name: true },
      }),
    ]);

    const result: AssessmentRecord = {
      ...formatted,
      patientName: patient?.name ?? 'Unknown Patient',
      physiotherapistName: specialist?.name ?? 'Unknown Specialist',
    };

    if (patient) {
      result.patient = { id: patient.id, name: patient.name };
    }
    if (specialist) {
      result.specialist = { id: specialist.id, name: specialist.name };
    }

    return result;
  }

  static async getAssessments(patientId?: string, page = 1, limit = 10): Promise<{ assessments: AssessmentRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number; }; }> {
    const skip = (page - 1) * limit;
    const filters: Prisma.SystemConfigWhereInput[] = [];
    if (patientId) {
      filters.push(jsonEquals('patientId', patientId));
    }

    const where = buildWhere(ASSESSMENT_KEY_PREFIX, filters);

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const assessments = records
      .map(formatAssessment)
      .filter((assessment): assessment is AssessmentRecord => assessment !== null);

    // Enrich assessments with patient and specialist names
    const enrichedAssessments = await Promise.all(
      assessments.map(async (assessment) => {
        const [patient, specialist] = await Promise.all([
          prisma.patient.findUnique({
            where: { id: assessment.patientId },
            select: { id: true, name: true },
          }),
          prisma.user.findUnique({
            where: { id: assessment.specialistId },
            select: { id: true, name: true },
          }),
        ]);

        const result: AssessmentRecord = {
          ...assessment,
          patientName: patient?.name ?? 'Unknown Patient',
          physiotherapistName: specialist?.name ?? 'Unknown Specialist',
        };

        if (patient) {
          result.patient = { id: patient.id, name: patient.name };
        }
        if (specialist) {
          result.specialist = { id: specialist.id, name: specialist.name };
        }

        return result;
      })
    );

    return {
      assessments: enrichedAssessments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getAssessmentById(id: string): Promise<AssessmentRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    const assessment = formatAssessment(record);
    if (!assessment) {
      return null;
    }

    // Enrich with patient and specialist names
    const [patient, specialist] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: assessment.patientId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: assessment.specialistId },
        select: { id: true, name: true },
      }),
    ]);

    const result: AssessmentRecord = {
      ...assessment,
      patientName: patient?.name ?? 'Unknown Patient',
      physiotherapistName: specialist?.name ?? 'Unknown Specialist',
    };

    if (patient) {
      result.patient = { id: patient.id, name: patient.name };
    }
    if (specialist) {
      result.specialist = { id: specialist.id, name: specialist.name };
    }

    return result;
  }

  static async updateAssessment(id: string, data: Partial<CreateAssessmentData>): Promise<AssessmentRecord> {
    const existing = await prisma.systemConfig.findUnique({ where: { id } });
    if (!existing || !existing.key.startsWith(ASSESSMENT_KEY_PREFIX)) {
      throw new Error('Assessment not found');
    }

    const current = toJsonObject(existing.value);
    const updates: JsonObject = {};

    if (data.patientId !== undefined) updates.patientId = data.patientId;
    if (data.specialistId !== undefined) updates.specialistId = data.specialistId;
    if (data.assessmentDate !== undefined) updates.assessmentDate = new Date(data.assessmentDate).toISOString();
    if (data.chiefComplaint !== undefined) updates.chiefComplaint = data.chiefComplaint;
    if (data.history !== undefined) updates.history = data.history;
    if (data.examination !== undefined) updates.examination = data.examination;
    if (data.diagnosis !== undefined) updates.diagnosis = data.diagnosis;
    if (data.recommendations !== undefined) updates.recommendations = data.recommendations;
    if ((data as any).injuryType !== undefined) updates.injuryType = (data as any).injuryType;
    if ((data as any).affectedArea !== undefined) {
      const affected = (data as any).affectedArea;
      updates.affectedArea = Array.isArray(affected) ? affected : [];
    }
    if ((data as any).painScale !== undefined) {
      const pain = (data as any).painScale;
      updates.painScale =
        typeof pain === 'number'
          ? pain
          : pain !== undefined
          ? Number(pain) || 0
          : undefined;
    }
    if ((data as any).mobilityLevel !== undefined) {
      updates.mobilityLevel = (data as any).mobilityLevel;
    }
    if ((data as any).functionalLimitations !== undefined) {
      const func = (data as any).functionalLimitations;
      updates.functionalLimitations = Array.isArray(func) ? func : [];
    }
    if ((data as any).medicalHistory !== undefined) {
      updates.medicalHistory = (data as any).medicalHistory;
    }
    if ((data as any).currentMedications !== undefined) {
      const meds = (data as any).currentMedications;
      updates.currentMedications = Array.isArray(meds) ? meds : [];
    }
    if ((data as any).assessmentNotes !== undefined) {
      updates.assessmentNotes = (data as any).assessmentNotes;
    }
    if (data.goals !== undefined) {
      if (Array.isArray(data.goals) && data.goals.length > 0) {
        updates.goals = data.goals;
      } else {
        // Remove goals if empty array or undefined
        updates.goals = null;
      }
    }
    if (data.nextAppointment !== undefined) {
      if (data.nextAppointment) {
        updates.nextAppointment = new Date(data.nextAppointment).toISOString();
      } else {
        // Remove nextAppointment if undefined/empty
        updates.nextAppointment = null;
      }
    }

    const updatedRecord = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: mergeUpdate(current, updates),
      },
    });

    logger.info('Assessment updated', { assessmentId: id });
    const formatted = formatAssessment(updatedRecord);
    if (!formatted) {
      throw new Error('Assessment not found');
    }

    // Enrich with patient and specialist names
    const [patient, specialist] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: formatted.patientId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: formatted.specialistId },
        select: { id: true, name: true },
      }),
    ]);

    const result: AssessmentRecord = {
      ...formatted,
      patientName: patient?.name ?? 'Unknown Patient',
      physiotherapistName: specialist?.name ?? 'Unknown Specialist',
    };

    if (patient) {
      result.patient = { id: patient.id, name: patient.name };
    }
    if (specialist) {
      result.specialist = { id: specialist.id, name: specialist.name };
    }

    return result;
  }

  static async deleteAssessment(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(ASSESSMENT_KEY_PREFIX)) {
      throw new Error('Assessment not found');
    }
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Assessment deleted', { assessmentId: id });
  }

  // Treatment Plans
  static async createTreatmentPlan(data: CreateTreatmentPlanData): Promise<TreatmentPlanRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${TREATMENT_PLAN_KEY_PREFIX}${Date.now()}`,
        category: TREATMENT_PLAN_CATEGORY,
        value: buildTreatmentPlanValue(data),
      },
    });

    logger.info('Treatment plan created', { planId: record.id });
    const formatted = formatTreatmentPlan(record);
    if (!formatted) {
      throw new Error('Failed to create treatment plan');
    }
    return formatted;
  }

  static async getTreatmentPlans(patientId?: string, page = 1, limit = 10): Promise<{ treatmentPlans: TreatmentPlanRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number; }; }> {
    const skip = (page - 1) * limit;
    const filters: Prisma.SystemConfigWhereInput[] = [];
    if (patientId) {
      filters.push(jsonEquals('patientId', patientId));
    }

    const where = buildWhere(TREATMENT_PLAN_KEY_PREFIX, filters);

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const plans = records
      .map(formatTreatmentPlan)
      .filter((plan): plan is TreatmentPlanRecord => plan !== null);

    // Enrich treatment plans with patient and specialist names
    const enrichedPlans: TreatmentPlanRecord[] = await Promise.all(
      plans.map(async (plan) => {
        const [patient, specialist] = await Promise.all([
          prisma.patient.findUnique({
            where: { id: plan.patientId },
            select: { id: true, name: true },
          }),
          prisma.user.findUnique({
            where: { id: plan.specialistId },
            select: { id: true, name: true },
          }),
        ]);

        const result: TreatmentPlanRecord = {
          ...plan,
          patientName: patient?.name ?? 'Unknown Patient',
          physiotherapistName: specialist?.name ?? 'Unknown Specialist',
        };

        if (patient) {
          result.patient = { id: patient.id, name: patient.name };
        }
        if (specialist) {
          result.specialist = { id: specialist.id, name: specialist.name };
        }

        return result;
      })
    );

    return {
      treatmentPlans: enrichedPlans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getTreatmentPlanById(id: string): Promise<TreatmentPlanRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    const plan = formatTreatmentPlan(record);
    if (!plan) {
      return null;
    }

    const [patient, specialist] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: plan.patientId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: plan.specialistId },
        select: { id: true, name: true },
      }),
    ]);

    const result: TreatmentPlanRecord = {
      ...plan,
      patientName: patient?.name ?? 'Unknown Patient',
      physiotherapistName: specialist?.name ?? 'Unknown Specialist',
    };

    if (patient) {
      result.patient = { id: patient.id, name: patient.name };
    }
    if (specialist) {
      result.specialist = { id: specialist.id, name: specialist.name };
    }

    return result;
  }

  static async updateTreatmentPlan(id: string, data: Partial<CreateTreatmentPlanData>): Promise<TreatmentPlanRecord> {
    const existing = await prisma.systemConfig.findUnique({ where: { id } });
    if (!existing || !existing.key.startsWith(TREATMENT_PLAN_KEY_PREFIX)) {
      throw new Error('Treatment plan not found');
    }

    const current = toJsonObject(existing.value);
    const updates: JsonObject = {};

    if (data.patientId !== undefined) updates.patientId = data.patientId;
    if (data.assessmentId !== undefined) updates.assessmentId = data.assessmentId;
    if (data.specialistId !== undefined) updates.specialistId = data.specialistId;
    if (data.goals !== undefined) updates.goals = data.goals;
    if (data.exercises !== undefined) updates.exercises = data.exercises as Prisma.JsonArray;
    if (data.modalities !== undefined) updates.modalities = data.modalities as Prisma.JsonArray;
    if (data.duration !== undefined) updates.duration = data.duration;
    if (data.frequency !== undefined) updates.frequency = data.frequency;
    if ((data as any).planName !== undefined) updates.planName = (data as any).planName;
    if ((data as any).startDate !== undefined) {
      const start = (data as any).startDate;
      updates.startDate = start ? new Date(start).toISOString() : null;
    }
    if ((data as any).endDate !== undefined) {
      const end = (data as any).endDate;
      updates.endDate = end ? new Date(end).toISOString() : null;
    }
    if ((data as any).status !== undefined) updates.status = (data as any).status;
    if ((data as any).progressNotes !== undefined) updates.progressNotes = (data as any).progressNotes;

    const updatedRecord = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: mergeUpdate(current, updates),
      },
    });

    logger.info('Treatment plan updated', { planId: id });
    const formatted = formatTreatmentPlan(updatedRecord);
    if (!formatted) {
      throw new Error('Treatment plan not found');
    }
    return formatted;
  }

  static async deleteTreatmentPlan(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(TREATMENT_PLAN_KEY_PREFIX)) {
      throw new Error('Treatment plan not found');
    }
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Treatment plan deleted', { planId: id });
  }

  // Sessions
  static async createSession(data: CreateSessionData): Promise<SessionRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${SESSION_KEY_PREFIX}${Date.now()}`,
        category: SESSION_CATEGORY,
        value: buildSessionValue(data),
      },
    });

    logger.info('Physiotherapy session created', { sessionId: record.id });
    const formatted = formatSession(record);
    if (!formatted) {
      throw new Error('Failed to create session');
    }
    return formatted;
  }

  static async getSessions(patientId?: string, treatmentPlanId?: string, page = 1, limit = 10): Promise<{ sessions: SessionRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number; }; }> {
    const skip = (page - 1) * limit;
    const filters: Prisma.SystemConfigWhereInput[] = [];

    if (patientId) {
      filters.push(jsonEquals('patientId', patientId));
    }
    if (treatmentPlanId) {
      filters.push(jsonEquals('treatmentPlanId', treatmentPlanId));
    }

    const where = buildWhere(SESSION_KEY_PREFIX, filters);

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const sessions = records
      .map(formatSession)
      .filter((session): session is SessionRecord => session !== null);

    const enrichedSessions: SessionRecord[] = await Promise.all(
      sessions.map(async (session) => {
        const [patient, specialist] = await Promise.all([
          prisma.patient.findUnique({
            where: { id: session.patientId },
            select: { id: true, name: true },
          }),
          prisma.user.findUnique({
            where: { id: session.specialistId },
            select: { id: true, name: true },
          }),
        ]);

        const result: SessionRecord = {
          ...session,
          patientName: patient?.name ?? 'Unknown Patient',
          physiotherapistName: specialist?.name ?? 'Unknown Specialist',
        };

        if (patient) {
          result.patient = { id: patient.id, name: patient.name };
        }
        if (specialist) {
          result.specialist = { id: specialist.id, name: specialist.name };
        }

        return result;
      })
    );

    return {
      sessions: enrichedSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getSessionById(id: string): Promise<SessionRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    const session = formatSession(record);
    if (!session) {
      return null;
    }

    const [patient, specialist] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: session.patientId },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: session.specialistId },
        select: { id: true, name: true },
      }),
    ]);

    const result: SessionRecord = {
      ...session,
      patientName: patient?.name ?? 'Unknown Patient',
      physiotherapistName: specialist?.name ?? 'Unknown Specialist',
    };

    if (patient) {
      result.patient = { id: patient.id, name: patient.name };
    }
    if (specialist) {
      result.specialist = { id: specialist.id, name: specialist.name };
    }

    return result;
  }

  static async updateSession(id: string, data: Partial<CreateSessionData>): Promise<SessionRecord> {
    const existing = await prisma.systemConfig.findUnique({ where: { id } });
    if (!existing || !existing.key.startsWith(SESSION_KEY_PREFIX)) {
      throw new Error('Session not found');
    }

    const current = toJsonObject(existing.value);
    const updates: JsonObject = {};

    if (data.patientId !== undefined) updates.patientId = data.patientId;
    if (data.treatmentPlanId !== undefined) updates.treatmentPlanId = data.treatmentPlanId;
    if (data.specialistId !== undefined) updates.specialistId = data.specialistId;
    if (data.sessionDate !== undefined) updates.sessionDate = new Date(data.sessionDate).toISOString();
    if (data.exercises !== undefined) updates.exercises = data.exercises as Prisma.JsonArray;
    if (data.modalities !== undefined) updates.modalities = data.modalities as Prisma.JsonArray;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.duration !== undefined) updates.duration = data.duration;
    if ((data as any).sessionTime !== undefined) updates.sessionTime = (data as any).sessionTime;
    if ((data as any).painLevelBefore !== undefined) updates.painLevelBefore = (data as any).painLevelBefore;
    if ((data as any).painLevelAfter !== undefined) updates.painLevelAfter = (data as any).painLevelAfter;
    if ((data as any).functionalImprovement !== undefined) {
      updates.functionalImprovement = (data as any).functionalImprovement;
    }
    if ((data as any).patientFeedback !== undefined) updates.patientFeedback = (data as any).patientFeedback;
    if ((data as any).nextSessionDate !== undefined) {
      const next = (data as any).nextSessionDate;
      updates.nextSessionDate = next ? new Date(next).toISOString() : null;
    }

    const updatedRecord = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: mergeUpdate(current, updates),
      },
    });

    logger.info('Session updated', { sessionId: id });
    const formatted = formatSession(updatedRecord);
    if (!formatted) {
      throw new Error('Session not found');
    }
    return formatted;
  }

  static async deleteSession(id: string): Promise<void> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record || !record.key.startsWith(SESSION_KEY_PREFIX)) {
      throw new Error('Session not found');
    }
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Session deleted', { sessionId: id });
  }

  // Exercises and Modalities (static data)
  static async getExercises() {
    return [
      { id: '1', name: 'Range of Motion', description: 'Improve joint flexibility' },
      { id: '2', name: 'Strengthening', description: 'Build muscle strength' },
      { id: '3', name: 'Balance', description: 'Improve balance and coordination' },
      { id: '4', name: 'Cardio', description: 'Cardiovascular exercise' },
    ];
  }

  static async getModalities() {
    return [
      { id: '1', name: 'Heat Therapy', description: 'Application of heat' },
      { id: '2', name: 'Cold Therapy', description: 'Application of cold' },
      { id: '3', name: 'Electrical Stimulation', description: 'TENS/EMS' },
      { id: '4', name: 'Ultrasound', description: 'Ultrasound therapy' },
    ];
  }
}

