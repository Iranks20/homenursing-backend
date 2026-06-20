import prisma from '../config/database';
import { NurseApplicationStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import ApplicationService from './application.service';

export type ISODateString = string;

export interface CreateExamData {
  title: string;
  description?: string;
  duration: number;
  passingScore: number;
  maxAttempts?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  questions: CreateQuestionData[];
}

export interface CreateQuestionData {
  question: string;
  type?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  options: string[];
  correctAnswer: number;
  points?: number;
  explanation?: string;
}

export interface ExamRecord {
  id: string;
  title: string;
  description?: string;
  duration: number;
  passingScore: number;
  status: string;
  maxAttempts: number;
  createdById: string;
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  questions?: QuestionRecord[];
  createdByName?: string;
}

export interface QuestionRecord {
  id: string;
  examId: string;
  question: string;
  type: string;
  options: string[];
  correctAnswer: number;
  points: number;
  order: number;
  explanation?: string;
}

export interface CreateAttemptData {
  examId: string;
  userId: string;
}

export type CertificateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExamCertificateRecord {
  id: string;
  examId: string;
  attemptId: string;
  userId: string;
  status: CertificateStatus;
  score: number;
  certificateNumber: string;
  issuedAt: ISODateString;
  approvedAt?: ISODateString;
  approvedById?: string;
  examTitle?: string;
  userName?: string;
  approvedByName?: string;
  metadata?: Record<string, unknown>;
}

export interface AttemptRecord {
  id: string;
  examId: string;
  userId: string;
  startedAt: ISODateString;
  submittedAt?: ISODateString;
  score?: number;
  passed?: boolean;
  timeSpent?: number;
  status: string;
  userName?: string;
  examTitle?: string;
  questionOrder?: string[];
  certificate?: ExamCertificateRecord;
}

export interface SubmitAnswerData {
  questionId: string;
  selectedAnswer: number;
}

export interface AnswerRecord {
  id: string;
  attemptId: string;
  questionId: string;
  selectedAnswer?: number;
  isCorrect?: boolean;
  pointsEarned?: number;
  question?: QuestionRecord;
}

const shuffleArray = <T>(items: T[]): T[] => {
  const array: T[] = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp: T = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
};

const certificateInclude = {
  include: {
    exam: {
      select: { title: true },
    },
    user: {
      select: { name: true },
    },
    approvedBy: {
      select: { name: true },
    },
  },
};

const generateCertificateNumber = (): string => {
  const randomSegment = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `CERT-${Date.now()}-${randomSegment}`;
};

export class ExamService {
  static async createExam(data: CreateExamData, createdById: string): Promise<ExamRecord> {
    if (!data.questions || data.questions.length === 0) {
      throw new CustomError('Exam must have at least one question', 400);
    }

    if (data.passingScore < 0 || data.passingScore > 100) {
      throw new CustomError('Passing score must be between 0 and 100', 400);
    }

    if (data.duration <= 0) {
      throw new CustomError('Duration must be greater than 0', 400);
    }

    const exam = await prisma.trainingExam.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        duration: data.duration,
        passingScore: data.passingScore,
        maxAttempts: data.maxAttempts ?? 3,
        status: data.status ?? 'DRAFT',
        createdById,
        questions: {
          create: data.questions.map((q, index) => ({
            question: q.question,
            type: q.type ?? 'MULTIPLE_CHOICE',
            options: q.options,
            correctAnswer: q.correctAnswer,
            points: q.points ?? 1,
            order: index + 1,
            explanation: q.explanation ?? null,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });

    logger.info('Exam created', { examId: exam.id });

    return this.formatExam(exam);
  }

  static async getExams(
    page = 1,
    limit = 10,
    status?: string,
    userId?: string
  ): Promise<{ exams: ExamRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.createdById = userId;
    }

    const [exams, total] = await Promise.all([
      prisma.trainingExam.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          questions: {
            orderBy: { order: 'asc' },
          },
          createdBy: {
            select: { name: true },
          },
        },
      }),
      prisma.trainingExam.count({ where }),
    ]);

    return {
      exams: exams.map(this.formatExam),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getExamById(id: string, includeAnswers = false): Promise<ExamRecord | null> {
    const exam = await prisma.trainingExam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });

    if (!exam) {
      return null;
    }

    const formatted = this.formatExam(exam);

    if (!includeAnswers && formatted.questions) {
      formatted.questions = formatted.questions.map((q) => ({
        ...q,
        correctAnswer: -1,
      }));
    }

    return formatted;
  }

  static async updateExam(id: string, data: Partial<CreateExamData>, userId: string): Promise<ExamRecord> {
    const existing = await prisma.trainingExam.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new CustomError('Exam not found', 404);
    }

    if (existing.createdById !== userId) {
      throw new CustomError('You can only update exams you created', 403);
    }

    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.duration !== undefined) {
      if (data.duration <= 0) {
        throw new CustomError('Duration must be greater than 0', 400);
      }
      updateData.duration = data.duration;
    }
    if (data.passingScore !== undefined) {
      if (data.passingScore < 0 || data.passingScore > 100) {
        throw new CustomError('Passing score must be between 0 and 100', 400);
      }
      updateData.passingScore = data.passingScore;
    }
    if (data.maxAttempts !== undefined) updateData.maxAttempts = data.maxAttempts;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.questions !== undefined && data.questions.length > 0) {
      await prisma.trainingExamQuestion.deleteMany({
        where: { examId: id },
      });

      updateData.questions = {
        create: data.questions.map((q, index) => ({
          question: q.question,
          type: q.type ?? 'MULTIPLE_CHOICE',
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points ?? 1,
          order: index + 1,
          explanation: q.explanation,
        })),
      };
    }

    const updated = await prisma.trainingExam.update({
      where: { id },
      data: updateData,
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: { name: true },
        },
      },
    });

    logger.info('Exam updated', { examId: id });

    return this.formatExam(updated);
  }

  static async deleteExam(id: string, userId: string): Promise<void> {
    const existing = await prisma.trainingExam.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new CustomError('Exam not found', 404);
    }

    if (existing.createdById !== userId) {
      throw new CustomError('You can only delete exams you created', 403);
    }

    await prisma.trainingExam.delete({
      where: { id },
    });

    logger.info('Exam deleted', { examId: id });
  }

  static async startAttempt(examId: string, userId: string): Promise<AttemptRecord> {
    const exam = await prisma.trainingExam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: { id: true },
        },
      },
    });

    if (!exam) {
      throw new CustomError('Exam not found', 404);
    }

    if (exam.status !== 'PUBLISHED') {
      throw new CustomError('Exam is not available', 400);
    }

    if (!exam.questions || exam.questions.length === 0) {
      throw new CustomError('Exam has no questions configured', 400);
    }

    const application = await prisma.nurseApplication.findUnique({ where: { userId } });
    if (application) {
      const examCompleteStatuses: NurseApplicationStatus[] = [
        NurseApplicationStatus.EXAM_PASSED,
        NurseApplicationStatus.INTERVIEW_SCHEDULED,
        NurseApplicationStatus.INTERVIEW_PASSED,
        NurseApplicationStatus.CERTIFIED,
        NurseApplicationStatus.RECRUITED,
      ];
      if (examCompleteStatuses.includes(application.status)) {
        throw new CustomError(
          'You have already passed the qualification exam. Continue on My Progress to book your interview.',
          400
        );
      }
    }

    const existingAttempts = await prisma.trainingExamAttempt.count({
      where: {
        examId,
        userId,
        status: { in: ['IN_PROGRESS', 'SUBMITTED'] },
      },
    });

    if (existingAttempts >= exam.maxAttempts) {
      throw new CustomError(`Maximum attempts (${exam.maxAttempts}) reached for this exam`, 400);
    }

    const questionOrder = shuffleArray(exam.questions.map((question) => question.id));

    const attempt = await prisma.trainingExamAttempt.create({
      data: {
        examId,
        userId,
        status: 'IN_PROGRESS',
        questionOrder,
      },
      include: {
        user: {
          select: { name: true },
        },
        exam: {
          select: { title: true },
        },
        certificate: certificateInclude,
      },
    });

    logger.info('Exam attempt started', { attemptId: attempt.id });

    return this.formatAttempt(attempt);
  }

  static async submitAttempt(
    attemptId: string,
    userId: string,
    answers: SubmitAnswerData[]
  ): Promise<AttemptRecord> {
    const attempt = await prisma.trainingExamAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
            },
          },
        },
        user: {
          select: { name: true },
        },
        certificate: certificateInclude,
      },
    });

    if (!attempt) {
      throw new CustomError('Attempt not found', 404);
    }

    if (attempt.userId !== userId) {
      throw new CustomError('You can only submit your own attempts', 403);
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new CustomError('Attempt has already been submitted', 400);
    }

    const timeSpent = Math.floor((new Date().getTime() - attempt.startedAt.getTime()) / 1000 / 60);

    const questionMap = new Map(attempt.exam.questions.map((q) => [q.id, q]));
    const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]));

    let totalPoints = 0;
    let earnedPoints = 0;

    const answerRecords = attempt.exam.questions.map((question) => {
      const selectedAnswer = answerMap.get(question.id);
      const isCorrect = selectedAnswer !== undefined && selectedAnswer === question.correctAnswer;
      const pointsEarned = isCorrect ? question.points : 0;

      totalPoints += question.points;
      earnedPoints += pointsEarned;

      return {
        questionId: question.id,
        selectedAnswer: selectedAnswer ?? null,
        isCorrect,
        pointsEarned,
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = score >= attempt.exam.passingScore;

    const applicant = await prisma.nurseApplication.findUnique({
      where: { userId: attempt.userId },
    });

    if (passed && !applicant) {
      const metadata = {
        candidateName: attempt.user?.name ?? '',
        examTitle: attempt.exam.title,
        score,
        generatedAt: new Date().toISOString(),
      };

      await prisma.trainingExamCertificate.upsert({
        where: { attemptId },
        create: {
          examId: attempt.examId,
          attemptId,
          userId: attempt.userId,
          score,
          certificateNumber: generateCertificateNumber(),
          metadata,
        },
        update: {
          score,
          metadata,
        },
      });
    }

    if (applicant) {
      await ApplicationService.handleExamAttemptResult(attempt.userId, attemptId, passed);
    }

    await prisma.trainingExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score,
        passed,
        timeSpent,
        answers: {
          create: answerRecords,
        },
      },
    });

    const updated = await prisma.trainingExamAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: {
          select: { name: true },
        },
        exam: {
          select: { title: true },
        },
        certificate: certificateInclude,
      },
    });

    if (!updated) {
      throw new CustomError('Failed to update attempt', 500);
    }

    logger.info('Exam attempt submitted', { attemptId, score, passed });

    return this.formatAttempt(updated);
  }

  static async getAttempts(
    examId?: string,
    userId?: string,
    page = 1,
    limit = 10
  ): Promise<{ attempts: AttemptRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (examId) {
      where.examId = examId;
    }

    if (userId) {
      where.userId = userId;
    }

    const [attempts, total] = await Promise.all([
      prisma.trainingExamAttempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true },
          },
          exam: {
            select: { title: true },
          },
          certificate: certificateInclude,
        },
      }),
      prisma.trainingExamAttempt.count({ where }),
    ]);

    return {
      attempts: attempts.map(this.formatAttempt),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getAttemptById(attemptId: string, userId?: string, userRole: string = 'NURSE'): Promise<AttemptRecord | null> {
    const attempt = await prisma.trainingExamAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: {
          select: { name: true },
        },
        exam: {
          select: { title: true },
        },
        answers: {
          include: {
            question: true,
          },
        },
        certificate: certificateInclude,
      },
    });

    if (!attempt) {
      return null;
    }

    if (userRole !== 'ADMIN' && userRole !== 'TRAINER' && userId && attempt.userId !== userId) {
      throw new CustomError('You can only view your own attempts', 403);
    }

    return this.formatAttempt(attempt);
  }

  static async getCertificates(
    page = 1,
    limit = 10,
    status?: CertificateStatus,
    userId?: string
  ): Promise<{ certificates: ExamCertificateRecord[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [records, total] = await Promise.all([
      prisma.trainingExamCertificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        ...certificateInclude,
      }),
      prisma.trainingExamCertificate.count({ where }),
    ]);

    return {
      certificates: records.map(this.formatCertificate),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getCertificateById(
    certificateId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<ExamCertificateRecord> {
    const certificate = await prisma.trainingExamCertificate.findUnique({
      where: { id: certificateId },
      ...certificateInclude,
    });

    if (!certificate) {
      throw new CustomError('Certificate not found', 404);
    }

    if (requesterRole !== 'ADMIN' && certificate.userId !== requesterId) {
      throw new CustomError('Access denied', 403);
    }

    return this.formatCertificate(certificate);
  }

  static async approveCertificate(certificateId: string, adminId: string): Promise<ExamCertificateRecord> {
    const certificate = await prisma.trainingExamCertificate.findUnique({
      where: { id: certificateId },
      ...certificateInclude,
    });

    if (!certificate) {
      throw new CustomError('Certificate not found', 404);
    }

    if (certificate.status === 'APPROVED') {
      throw new CustomError('Certificate already approved', 400);
    }

    const approved = await prisma.trainingExamCertificate.update({
      where: { id: certificateId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: adminId,
      },
      ...certificateInclude,
    });

    logger.info('Certificate approved', { certificateId, adminId });

    return this.formatCertificate(approved);
  }

  static async getUserCertificates(userId: string, status?: CertificateStatus): Promise<ExamCertificateRecord[]> {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const certificates = await prisma.trainingExamCertificate.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      ...certificateInclude,
    });

    return certificates.map(this.formatCertificate);
  }

  private static formatExam(exam: any): ExamRecord {
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description ?? undefined,
      duration: exam.duration,
      passingScore: exam.passingScore,
      status: exam.status,
      maxAttempts: exam.maxAttempts,
      createdById: exam.createdById,
      createdAt: exam.createdAt.toISOString(),
      updatedAt: exam.updatedAt?.toISOString(),
      createdByName: exam.createdBy?.name,
      questions: exam.questions?.map((q: any) => ({
        id: q.id,
        examId: q.examId,
        question: q.question,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
        order: q.order,
        explanation: q.explanation ?? undefined,
      })),
    };
  }

  private static formatAttempt(attempt: any): AttemptRecord {
    const result: AttemptRecord = {
      id: attempt.id,
      examId: attempt.examId,
      userId: attempt.userId,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString(),
      score: attempt.score ?? undefined,
      passed: attempt.passed ?? undefined,
      timeSpent: attempt.timeSpent ?? undefined,
      status: attempt.status,
      userName: attempt.user?.name,
      examTitle: attempt.exam?.title,
      questionOrder: attempt.questionOrder ?? [],
    };
    
    if (attempt.certificate) {
      result.certificate = this.formatCertificate(attempt.certificate);
    }
    
    return result;
  }

  private static formatCertificate(certificate: any): ExamCertificateRecord {
    return {
      id: certificate.id,
      examId: certificate.examId,
      attemptId: certificate.attemptId,
      userId: certificate.userId,
      status: certificate.status,
      score: certificate.score,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.issuedAt.toISOString(),
      approvedAt: certificate.approvedAt?.toISOString(),
      approvedById: certificate.approvedById ?? undefined,
      examTitle: certificate.exam?.title,
      userName: certificate.user?.name,
      approvedByName: certificate.approvedBy?.name,
      metadata: certificate.metadata ?? undefined,
    };
  }
}

