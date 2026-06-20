import { Request, Response, NextFunction } from 'express';
import {
  ExamService,
  CreateExamData,
  SubmitAnswerData,
  CertificateStatus,
} from '../services/exam.service';
import { CustomError } from '../middleware/error.middleware';

const requireId = (id: string | undefined, resource: string): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

const requireUserId = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new CustomError('Unauthorized', 401);
  }
  return userId;
};

const requireBodyField = <T>(value: T | undefined, fieldName: string): T => {
  if (value === undefined || value === null) {
    throw new CustomError(`${fieldName} is required`, 400);
  }
  return value;
};

export class ExamController {
  static async createExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const body = req.body;

      const payload: CreateExamData = {
        title: requireBodyField(body.title, 'title'),
        description: body.description,
        duration: Number(requireBodyField(body.duration, 'duration')),
        passingScore: Number(requireBodyField(body.passingScore, 'passingScore')),
        maxAttempts: body.maxAttempts ? Number(body.maxAttempts) : 3,
        status: body.status,
        questions: Array.isArray(body.questions) ? body.questions : [],
      };

      const exam = await ExamService.createExam(payload, userId);
      res.status(201).json({ success: true, message: 'Exam created successfully', data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async getExams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await ExamService.getExams(page, limit, status, userId);
      res.status(200).json({ success: true, data: result.exams, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getExamById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const includeAnswers = req.query.includeAnswers === 'true';
      const exam = await ExamService.getExamById(examId, includeAnswers);

      if (!exam) {
        throw new CustomError('Exam not found', 404);
      }

      res.status(200).json({ success: true, data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async updateExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const userId = requireUserId(req);
      const body = req.body;

      const payload: Partial<CreateExamData> = {};

      if (body.title !== undefined) payload.title = body.title;
      if (body.description !== undefined) payload.description = body.description;
      if (body.duration !== undefined) payload.duration = Number(body.duration);
      if (body.passingScore !== undefined) payload.passingScore = Number(body.passingScore);
      if (body.maxAttempts !== undefined) payload.maxAttempts = Number(body.maxAttempts);
      if (body.status !== undefined) payload.status = body.status;
      if (body.questions !== undefined) {
        if (!Array.isArray(body.questions)) {
          throw new CustomError('questions must be an array', 400);
        }
        payload.questions = body.questions;
      }

      const exam = await ExamService.updateExam(examId, payload, userId);
      res.status(200).json({ success: true, message: 'Exam updated successfully', data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const userId = requireUserId(req);

      await ExamService.deleteExam(examId, userId);
      res.status(200).json({ success: true, message: 'Exam deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async startAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const userId = requireUserId(req);

      const attempt = await ExamService.startAttempt(examId, userId);
      res.status(201).json({ success: true, message: 'Exam attempt started', data: attempt });
    } catch (error) {
      next(error);
    }
  }

  static async submitAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attemptId = requireId(req.params.id, 'Attempt');
      const userId = requireUserId(req);
      const body = req.body;

      if (!Array.isArray(body.answers)) {
        throw new CustomError('answers must be an array', 400);
      }

      const answers: SubmitAnswerData[] = body.answers.map((a: any) => ({
        questionId: requireBodyField(a.questionId, 'questionId'),
        selectedAnswer: Number(requireBodyField(a.selectedAnswer, 'selectedAnswer')),
      }));

      const attempt = await ExamService.submitAttempt(attemptId, userId, answers);
      res.status(200).json({ success: true, message: 'Exam submitted successfully', data: attempt });
    } catch (error) {
      next(error);
    }
  }

  static async getAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const examId = req.query.examId as string | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await ExamService.getAttempts(examId, userId, page, limit);
      res.status(200).json({ success: true, data: result.attempts, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getAttemptById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attemptId = requireId(req.params.id, 'Attempt');
      const userId = requireUserId(req);
      const requesterRole = ((req as Request & { user?: { role?: string } }).user?.role ?? 'NURSE').toUpperCase();
      const canViewAny = requesterRole === 'ADMIN' || requesterRole === 'TRAINER';

      const attempt = await ExamService.getAttemptById(attemptId, canViewAny ? undefined : userId, requesterRole);
      if (!attempt) {
        throw new CustomError('Attempt not found', 404);
      }

      res.status(200).json({ success: true, data: attempt });
    } catch (error) {
      next(error);
    }
  }

  static async getCertificates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const status = req.query.status as CertificateStatus | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await ExamService.getCertificates(page, limit, status, userId);
      res.status(200).json({ success: true, data: result.certificates, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async approveCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificateId = requireId(req.params.id, 'Certificate');
      const adminId = requireUserId(req);

      const certificate = await ExamService.approveCertificate(certificateId, adminId);
      res.status(200).json({ success: true, message: 'Certificate approved', data: certificate });
    } catch (error) {
      next(error);
    }
  }

  static async getMyCertificates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const status = req.query.status as CertificateStatus | undefined;

      const certificates = await ExamService.getUserCertificates(userId, status);
      res.status(200).json({ success: true, data: certificates });
    } catch (error) {
      next(error);
    }
  }

  static async getCertificateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificateId = requireId(req.params.id, 'Certificate');
      const requesterId = requireUserId(req);
      const requesterRole = (req as Request & { user?: { role?: string } }).user?.role ?? 'NURSE';

      const certificate = await ExamService.getCertificateById(certificateId, requesterId, requesterRole);
      res.status(200).json({ success: true, data: certificate });
    } catch (error) {
      next(error);
    }
  }
}

