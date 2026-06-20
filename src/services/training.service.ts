import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CreateClassData {
  name: string;
  description: string;
  instructorId: string;
  instructorName?: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  category: string;
  location?: string;
  duration?: number;
  status?: string;
}

export interface TrainingClassRecord {
  id: string;
  name: string;
  description: string;
  instructorId: string;
  instructorName?: string;
  startDate: string;
  endDate: string;
  capacity: number;
  category: string;
  status: string;
  enrolledCount: number;
  location?: string;
  duration?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateExamData {
  classId: string;
  title: string;
  description: string;
  questions: Prisma.JsonValue;
  passingScore: number;
  duration: number;
}

export interface ExamRecord {
  id: string;
  classId: string;
  title: string;
  description: string;
  questions: Prisma.JsonValue;
  passingScore: number;
  duration: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCertificationData {
  name: string;
  description: string;
  requirements: string[];
  validityPeriod: number;
  issuingOrganization: string;
}

export interface CertificationRecord {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  validityPeriod: number;
  issuingOrganization: string;
  createdAt: string;
  updatedAt?: string;
}

export interface EnrollmentRecord {
  id: string;
  classId: string;
  userId: string;
  enrolledAt: string;
  status: string;
}

export interface ExamSubmissionRecord {
  id: string;
  examId: string;
  userId: string;
  answers: Prisma.JsonValue;
  score: number;
  passed: boolean;
  submittedAt: string;
}

const CLASS_PREFIX = 'training_class_';
const CLASS_CATEGORY = 'training_class';
const ENROLLMENT_PREFIX = 'training_enrollment_';
const ENROLLMENT_CATEGORY = 'training_enrollment';
const EXAM_PREFIX = 'training_exam_';
const EXAM_CATEGORY = 'training_exam';
const EXAM_SUBMISSION_PREFIX = 'training_exam_submission_';
const EXAM_SUBMISSION_CATEGORY = 'training_exam_submission';
const CERTIFICATION_PREFIX = 'training_certification_';
const CERTIFICATION_CATEGORY = 'training_certification';

const toJsonObject = (value: Prisma.JsonValue | null): Prisma.JsonObject => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.JsonObject;
  }
  return {};
};

const toIsoString = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError('Invalid date value', 400);
  }
  return date.toISOString();
};

const getActualEnrolledCount = async (classId: string): Promise<number> => {
  const enrollments = await prisma.systemConfig.findMany({
    where: {
      category: ENROLLMENT_CATEGORY,
    },
  });

  return enrollments.filter((enrollment) => {
    const value = toJsonObject(enrollment.value);
    return value.classId === classId && value.status === 'enrolled';
  }).length;
};

const mapClassRecord = async (record: Prisma.SystemConfigGetPayload<{}>): Promise<TrainingClassRecord | null> => {
  if (!record.key.startsWith(CLASS_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  // Get actual enrolled count from enrollment records
  const actualEnrolledCount = await getActualEnrolledCount(record.id);

  const mapped: TrainingClassRecord = {
    id: record.id,
    name: String(value.name ?? ''),
    description: String(value.description ?? ''),
    instructorId: String(value.instructorId ?? ''),
    instructorName: String(value.instructorName ?? ''),
    startDate: String(value.startDate ?? ''),
    endDate: String(value.endDate ?? ''),
    capacity: Number(value.capacity ?? 0),
    category: String(value.category ?? ''),
    status: String(value.status ?? 'scheduled'),
    enrolledCount: actualEnrolledCount,
    location: String(value.location ?? ''),
    duration: Number(value.duration ?? 0),
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };

  if (value.updatedAt !== undefined) {
    mapped.updatedAt = String(value.updatedAt);
  }

  return mapped;
};

const buildClassValue = (data: CreateClassData): Prisma.InputJsonObject => ({
  name: data.name,
  description: data.description,
  instructorId: data.instructorId,
  instructorName: data.instructorName || '',
  startDate: toIsoString(data.startDate),
  endDate: toIsoString(data.endDate),
  capacity: data.capacity,
  category: data.category,
  status: data.status || 'scheduled',
  enrolledCount: 0,
  location: data.location || '',
  duration: data.duration || 0,
  createdAt: new Date().toISOString(),
});

const mapExamRecord = (record: Prisma.SystemConfigGetPayload<{}>): ExamRecord | null => {
  if (!record.key.startsWith(EXAM_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const mapped: ExamRecord = {
    id: record.id,
    classId: String(value.classId ?? ''),
    title: String(value.title ?? ''),
    description: String(value.description ?? ''),
    questions: value.questions ?? [],
    passingScore: Number(value.passingScore ?? 0),
    duration: Number(value.duration ?? 0),
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };

  if (value.updatedAt !== undefined) {
    mapped.updatedAt = String(value.updatedAt);
  }

  return mapped;
};

const buildExamValue = (data: CreateExamData): Prisma.InputJsonObject => ({
  classId: data.classId,
  title: data.title,
  description: data.description,
  questions: data.questions,
  passingScore: data.passingScore,
  duration: data.duration,
  createdAt: new Date().toISOString(),
});

const mapCertificationRecord = (record: Prisma.SystemConfigGetPayload<{}>): CertificationRecord | null => {
  if (!record.key.startsWith(CERTIFICATION_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  const mapped: CertificationRecord = {
    id: record.id,
    name: String(value.name ?? ''),
    description: String(value.description ?? ''),
    requirements: (value.requirements as string[] | undefined) ?? [],
    validityPeriod: Number(value.validityPeriod ?? 0),
    issuingOrganization: String(value.issuingOrganization ?? ''),
    createdAt: String(value.createdAt ?? record.createdAt.toISOString()),
  };

  if (value.updatedAt !== undefined) {
    mapped.updatedAt = String(value.updatedAt);
  }

  return mapped;
};

const buildCertificationValue = (data: CreateCertificationData): Prisma.InputJsonObject => ({
  name: data.name,
  description: data.description,
  requirements: data.requirements,
  validityPeriod: data.validityPeriod,
  issuingOrganization: data.issuingOrganization,
  createdAt: new Date().toISOString(),
});

const mapEnrollmentRecord = (record: Prisma.SystemConfigGetPayload<{}>): EnrollmentRecord | null => {
  if (!record.key.startsWith(ENROLLMENT_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  return {
    id: record.id,
    classId: String(value.classId ?? ''),
    userId: String(value.userId ?? ''),
    enrolledAt: String(value.enrolledAt ?? record.createdAt.toISOString()),
    status: String(value.status ?? 'enrolled'),
  };
};

const mapExamSubmissionRecord = (record: Prisma.SystemConfigGetPayload<{}>): ExamSubmissionRecord | null => {
  if (!record.key.startsWith(EXAM_SUBMISSION_PREFIX)) {
    return null;
  }

  const value = toJsonObject(record.value);

  return {
    id: record.id,
    examId: String(value.examId ?? ''),
    userId: String(value.userId ?? ''),
    answers: value.answers ?? [],
    score: Number(value.score ?? 0),
    passed: Boolean(value.passed),
    submittedAt: String(value.submittedAt ?? record.createdAt.toISOString()),
  };
};

const ensureClassRecord = async (id: string): Promise<{ record: Prisma.SystemConfigGetPayload<{}>; mapped: TrainingClassRecord }> => {
  const record = await prisma.systemConfig.findUnique({ where: { id } });
  if (!record) {
    throw new CustomError('Class not found', 404);
  }
  const mapped = await mapClassRecord(record);
  if (!mapped) {
    throw new CustomError('Class not found', 404);
  }
  return { record, mapped };
};

const ensureExamRecord = async (id: string): Promise<{ record: Prisma.SystemConfigGetPayload<{}>; mapped: ExamRecord }> => {
  const record = await prisma.systemConfig.findUnique({ where: { id } });
  if (!record) {
    throw new CustomError('Exam not found', 404);
  }
  const mapped = mapExamRecord(record);
  if (!mapped) {
    throw new CustomError('Exam not found', 404);
  }
  return { record, mapped };
};

const ensureCertificationRecord = async (id: string): Promise<{ record: Prisma.SystemConfigGetPayload<{}>; mapped: CertificationRecord }> => {
  const record = await prisma.systemConfig.findUnique({ where: { id } });
  if (!record) {
    throw new CustomError('Certification not found', 404);
  }
  const mapped = mapCertificationRecord(record);
  if (!mapped) {
    throw new CustomError('Certification not found', 404);
  }
  return { record, mapped };
};

export class TrainingService {
  // Classes
  static async createClass(data: CreateClassData): Promise<TrainingClassRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${CLASS_PREFIX}${Date.now()}`,
        category: CLASS_CATEGORY,
        value: buildClassValue(data),
      },
    });

    logger.info('Training class created', { classId: record.id });

    const mapped = await mapClassRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to create class', 500);
    }

    return mapped;
  }

  static async getClasses(page = 1, limit = 10): Promise<{ classes: TrainingClassRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: CLASS_PREFIX },
    };

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const classes = await Promise.all(
      records.map((record) => mapClassRecord(record))
    );
    const validClasses = classes.filter((record): record is TrainingClassRecord => record !== null);

    return {
      classes: validClasses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getClassById(id: string): Promise<TrainingClassRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return await mapClassRecord(record);
  }

  static async updateClass(id: string, data: Partial<CreateClassData>): Promise<TrainingClassRecord> {
    const { record } = await ensureClassRecord(id);
    const current = toJsonObject(record.value);

    if (data.startDate !== undefined) {
      current.startDate = toIsoString(data.startDate);
    }
    if (data.endDate !== undefined) {
      current.endDate = toIsoString(data.endDate);
    }
    if (data.name !== undefined) current.name = data.name;
    if (data.description !== undefined) current.description = data.description;
    if (data.instructorId !== undefined) current.instructorId = data.instructorId;
    if (data.instructorName !== undefined) current.instructorName = data.instructorName;
    if (data.capacity !== undefined) current.capacity = data.capacity;
    if (data.category !== undefined) current.category = data.category;
    if (data.location !== undefined) current.location = data.location;
    if (data.duration !== undefined) current.duration = data.duration;
    if (data.status !== undefined) current.status = data.status;

    current.updatedAt = new Date().toISOString();

    const updated = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: current as Prisma.InputJsonObject,
      },
    });

    const mapped = await mapClassRecord(updated);
    if (!mapped) {
      throw new CustomError('Class not found', 404);
    }

    logger.info('Training class updated', { classId: id });
    return mapped;
  }

  static async deleteClass(id: string): Promise<void> {
    const { mapped } = await ensureClassRecord(id);
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Training class deleted', { classId: mapped.id });
  }

  static async enrollInClass(classId: string, userId: string | undefined): Promise<EnrollmentRecord> {
    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    const classRecord = await this.getClassById(classId);
    if (!classRecord) {
      throw new CustomError('Class not found', 404);
    }

    // Check if user is already enrolled
    const allEnrollments = await prisma.systemConfig.findMany({
      where: {
        category: ENROLLMENT_CATEGORY,
      },
    });

    const existingEnrollments = allEnrollments.filter((enrollment) => {
      const value = toJsonObject(enrollment.value);
      return value.classId === classId;
    });

    const isAlreadyEnrolled = existingEnrollments.some((enrollment) => {
      const value = toJsonObject(enrollment.value);
      return value.userId === userId && value.status === 'enrolled';
    });

    if (isAlreadyEnrolled) {
      throw new CustomError('You are already enrolled in this class', 400);
    }

    // Check capacity
    const currentEnrolledCount = existingEnrollments.filter((enrollment) => {
      const value = toJsonObject(enrollment.value);
      return value.status === 'enrolled';
    }).length;

    if (currentEnrolledCount >= classRecord.capacity) {
      throw new CustomError('Class is at full capacity', 400);
    }

    // Create enrollment record
    const record = await prisma.systemConfig.create({
      data: {
        key: `${ENROLLMENT_PREFIX}${Date.now()}`,
        category: ENROLLMENT_CATEGORY,
        value: {
          classId,
          userId,
          enrolledAt: new Date().toISOString(),
          status: 'enrolled',
        } as Prisma.InputJsonObject,
      },
    });

    // Update enrolledCount in class record
    const classRecordData = await prisma.systemConfig.findUnique({ where: { id: classId } });
    if (classRecordData) {
      const classValue = toJsonObject(classRecordData.value);
      classValue.enrolledCount = currentEnrolledCount + 1;
      classValue.updatedAt = new Date().toISOString();

      await prisma.systemConfig.update({
        where: { id: classId },
        data: {
          value: classValue as Prisma.InputJsonObject,
        },
      });
    }

    logger.info('User enrolled in class', { enrollmentId: record.id, classId });

    const mapped = mapEnrollmentRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to enroll', 500);
    }

    return mapped;
  }

  // Exams
  static async createExam(data: CreateExamData): Promise<ExamRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${EXAM_PREFIX}${Date.now()}`,
        category: EXAM_CATEGORY,
        value: buildExamValue(data),
      },
    });

    logger.info('Exam created', { examId: record.id });

    const mapped = mapExamRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to create exam', 500);
    }

    return mapped;
  }

  static async getExams(classId?: string, page = 1, limit = 10): Promise<{ exams: ExamRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: EXAM_PREFIX },
    };

    if (classId) {
      where.value = {
        path: ['classId'],
        equals: classId,
      } as Prisma.JsonFilter;
    }

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const exams = records
      .map(mapExamRecord)
      .filter((record): record is ExamRecord => record !== null);

    return {
      exams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getExamById(id: string): Promise<ExamRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return mapExamRecord(record);
  }

  static async updateExam(id: string, data: Partial<CreateExamData>): Promise<ExamRecord> {
    const { record } = await ensureExamRecord(id);
    const current = toJsonObject(record.value);

    if (data.classId !== undefined) current.classId = data.classId;
    if (data.title !== undefined) current.title = data.title;
    if (data.description !== undefined) current.description = data.description;
    if (data.questions !== undefined) current.questions = data.questions;
    if (data.passingScore !== undefined) current.passingScore = data.passingScore;
    if (data.duration !== undefined) current.duration = data.duration;

    current.updatedAt = new Date().toISOString();

    const updated = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: current as Prisma.InputJsonObject,
      },
    });

    const mapped = mapExamRecord(updated);
    if (!mapped) {
      throw new CustomError('Exam not found', 404);
    }

    logger.info('Exam updated', { examId: id });
    return mapped;
  }

  static async deleteExam(id: string): Promise<void> {
    const { mapped } = await ensureExamRecord(id);
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Exam deleted', { examId: mapped.id });
  }

  static async submitExam(examId: string, userId: string | undefined, answers: Prisma.JsonValue): Promise<ExamSubmissionRecord> {
    if (!userId) {
      throw new CustomError('User ID is required', 400);
    }

    const exam = await this.getExamById(examId);
    if (!exam) {
      throw new CustomError('Exam not found', 404);
    }

    const score = Math.floor(Math.random() * 100);
    const passed = score >= exam.passingScore;

    const record = await prisma.systemConfig.create({
      data: {
        key: `${EXAM_SUBMISSION_PREFIX}${Date.now()}`,
        category: EXAM_SUBMISSION_CATEGORY,
        value: {
          examId,
          userId,
          answers,
          score,
          passed,
          submittedAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });

    logger.info('Exam submitted', { submissionId: record.id });

    const mapped = mapExamSubmissionRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to submit exam', 500);
    }

    return mapped;
  }

  // Certifications
  static async createCertification(data: CreateCertificationData): Promise<CertificationRecord> {
    const record = await prisma.systemConfig.create({
      data: {
        key: `${CERTIFICATION_PREFIX}${Date.now()}`,
        category: CERTIFICATION_CATEGORY,
        value: buildCertificationValue(data),
      },
    });

    logger.info('Certification created', { certId: record.id });

    const mapped = mapCertificationRecord(record);
    if (!mapped) {
      throw new CustomError('Failed to create certification', 500);
    }

    return mapped;
  }

  static async getCertifications(page = 1, limit = 10): Promise<{ certifications: CertificationRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: Prisma.SystemConfigWhereInput = {
      key: { startsWith: CERTIFICATION_PREFIX },
    };

    const [records, total] = await Promise.all([
      prisma.systemConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemConfig.count({ where }),
    ]);

    const certifications = records
      .map(mapCertificationRecord)
      .filter((record): record is CertificationRecord => record !== null);

    return {
      certifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getCertificationById(id: string): Promise<CertificationRecord | null> {
    const record = await prisma.systemConfig.findUnique({ where: { id } });
    if (!record) {
      return null;
    }
    return mapCertificationRecord(record);
  }

  static async updateCertification(id: string, data: Partial<CreateCertificationData>): Promise<CertificationRecord> {
    const { record } = await ensureCertificationRecord(id);
    const current = toJsonObject(record.value);

    if (data.name !== undefined) current.name = data.name;
    if (data.description !== undefined) current.description = data.description;
    if (data.requirements !== undefined) current.requirements = data.requirements;
    if (data.validityPeriod !== undefined) current.validityPeriod = data.validityPeriod;
    if (data.issuingOrganization !== undefined) current.issuingOrganization = data.issuingOrganization;

    current.updatedAt = new Date().toISOString();

    const updated = await prisma.systemConfig.update({
      where: { id },
      data: {
        value: current as Prisma.InputJsonObject,
      },
    });

    const mapped = mapCertificationRecord(updated);
    if (!mapped) {
      throw new CustomError('Certification not found', 404);
    }

    logger.info('Certification updated', { certId: id });
    return mapped;
  }

  static async deleteCertification(id: string): Promise<void> {
    const { mapped } = await ensureCertificationRecord(id);
    await prisma.systemConfig.delete({ where: { id } });
    logger.info('Certification deleted', { certId: mapped.id });
  }
}

