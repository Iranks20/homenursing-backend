import { Request, Response, NextFunction } from 'express';
import {
  TrainingService,
  CreateClassData,
  CreateExamData,
  CreateCertificationData,
} from '../services/training.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const parseDate = (value: unknown, field: string): Date => {
  if (!value) {
    throw new CustomError(`${field} is required`, 400);
  }
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

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

const parseString = (value: unknown, field: string): string => {
  if (value === undefined || value === null || value === '') {
    throw new CustomError(`${field} is required`, 400);
  }
  if (typeof value !== 'string') {
    throw new CustomError(`${field} must be a string`, 400);
  }
  return value;
};

const parseOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
};

const parseCreateClassPayload = (body: unknown): CreateClassData => {
  const data = body as Record<string, unknown>;
  const capacityValue = Number(data.capacity);
  if (Number.isNaN(capacityValue)) {
    throw new CustomError('capacity is required', 400);
  }

  const payload: CreateClassData = {
    name: parseString(data.name, 'name'),
    description: parseString(data.description, 'description'),
    instructorId: parseString(data.instructorId, 'instructorId'),
    startDate: parseDate(data.startDate, 'startDate'),
    endDate: parseDate(data.endDate, 'endDate'),
    capacity: capacityValue,
    category: parseString(data.category, 'category'),
  };

  if (data.instructorName) {
    payload.instructorName = parseString(data.instructorName, 'instructorName');
  }
  if (data.location) {
    payload.location = parseString(data.location, 'location');
  }
  if (data.duration !== undefined) {
    const duration = Number(data.duration);
    if (!Number.isNaN(duration)) {
      payload.duration = duration;
    }
  }
  if (data.status) {
    payload.status = parseString(data.status, 'status');
  }

  return payload;
};

const parseUpdateClassPayload = (body: unknown): Partial<CreateClassData> => {
  const data = body as Record<string, unknown>;
  const payload: Partial<CreateClassData> = {};

  if (data.name !== undefined) payload.name = parseString(data.name, 'name');
  if (data.description !== undefined) payload.description = parseString(data.description, 'description');
  if (data.instructorId !== undefined) payload.instructorId = parseString(data.instructorId, 'instructorId');
  if (data.instructorName !== undefined) payload.instructorName = parseString(data.instructorName, 'instructorName');
  if (data.startDate !== undefined) payload.startDate = parseDate(data.startDate, 'startDate');
  if (data.endDate !== undefined) payload.endDate = parseDate(data.endDate, 'endDate');
  if (data.capacity !== undefined) {
    const capacity = Number(data.capacity);
    if (Number.isNaN(capacity)) {
      throw new CustomError('capacity must be a number', 400);
    }
    payload.capacity = capacity;
  }
  if (data.category !== undefined) payload.category = parseString(data.category, 'category');
  if (data.location !== undefined) payload.location = parseString(data.location, 'location');
  if (data.duration !== undefined) {
    const duration = Number(data.duration);
    if (Number.isNaN(duration)) {
      throw new CustomError('duration must be a number', 400);
    }
    payload.duration = duration;
  }
  if (data.status !== undefined) payload.status = parseString(data.status, 'status');

  return payload;
};

const parseCreateExamPayload = (body: unknown): CreateExamData => {
  const data = body as Record<string, unknown>;
  const questions = data.questions ?? [];
  if (!Array.isArray(questions)) {
    throw new CustomError('questions must be an array', 400);
  }

  const passingScore = Number(data.passingScore);
  const duration = Number(data.duration);
  if (Number.isNaN(passingScore)) {
    throw new CustomError('passingScore is required', 400);
  }
  if (Number.isNaN(duration)) {
    throw new CustomError('duration is required', 400);
  }

  return {
    classId: parseString(data.classId, 'classId'),
    title: parseString(data.title, 'title'),
    description: parseString(data.description, 'description'),
    questions,
    passingScore,
    duration,
  };
};

const parseUpdateExamPayload = (body: unknown): Partial<CreateExamData> => {
  const data = body as Record<string, unknown>;
  const payload: Partial<CreateExamData> = {};

  if (data.classId !== undefined) payload.classId = parseString(data.classId, 'classId');
  if (data.title !== undefined) payload.title = parseString(data.title, 'title');
  if (data.description !== undefined) payload.description = parseString(data.description, 'description');
  if (data.questions !== undefined) {
    if (!Array.isArray(data.questions)) {
      throw new CustomError('questions must be an array', 400);
    }
    payload.questions = data.questions;
  }
  if (data.passingScore !== undefined) {
    const passingScore = Number(data.passingScore);
    if (Number.isNaN(passingScore)) {
      throw new CustomError('passingScore must be a number', 400);
    }
    payload.passingScore = passingScore;
  }
  if (data.duration !== undefined) {
    const duration = Number(data.duration);
    if (Number.isNaN(duration)) {
      throw new CustomError('duration must be a number', 400);
    }
    payload.duration = duration;
  }

  return payload;
};

const parseCreateCertificationPayload = (body: unknown): CreateCertificationData => {
  const data = body as Record<string, unknown>;
  const requirements = data.requirements;
  if (!Array.isArray(requirements)) {
    throw new CustomError('requirements must be an array', 400);
  }

  const validityPeriod = Number(data.validityPeriod);
  if (Number.isNaN(validityPeriod)) {
    throw new CustomError('validityPeriod is required', 400);
  }

  return {
    name: parseString(data.name, 'name'),
    description: parseString(data.description, 'description'),
    requirements: requirements.map(req => parseString(req, 'requirement')),
    validityPeriod,
    issuingOrganization: parseString(data.issuingOrganization, 'issuingOrganization'),
  };
};

const parseUpdateCertificationPayload = (body: unknown): Partial<CreateCertificationData> => {
  const data = body as Record<string, unknown>;
  const payload: Partial<CreateCertificationData> = {};

  if (data.name !== undefined) payload.name = parseString(data.name, 'name');
  if (data.description !== undefined) payload.description = parseString(data.description, 'description');
  if (data.requirements !== undefined) {
    if (!Array.isArray(data.requirements)) {
      throw new CustomError('requirements must be an array', 400);
    }
    payload.requirements = (data.requirements as unknown[]).map(req => parseString(req, 'requirement'));
  }
  if (data.validityPeriod !== undefined) {
    const validityPeriod = Number(data.validityPeriod);
    if (Number.isNaN(validityPeriod)) {
      throw new CustomError('validityPeriod must be a number', 400);
    }
    payload.validityPeriod = validityPeriod;
  }
  if (data.issuingOrganization !== undefined) payload.issuingOrganization = parseString(data.issuingOrganization, 'issuingOrganization');

  return payload;
};

export class TrainingController {
  static async getClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await TrainingService.getClasses(page, limit);
      res.status(200).json({ success: true, data: result.classes, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getClassById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classId = requireId(req.params.id, 'Class');
      const classData = await TrainingService.getClassById(classId);
      if (!classData) throw new CustomError('Class not found', 404);
      res.status(200).json({ success: true, data: classData });
    } catch (error) {
      next(error);
    }
  }

  static async createClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreateClassPayload(req.body);
      const classData = await TrainingService.createClass(payload);
      res.status(201).json({ success: true, message: 'Class created successfully', data: classData });
    } catch (error) {
      next(error);
    }
  }

  static async updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classId = requireId(req.params.id, 'Class');
      const payload = parseUpdateClassPayload(req.body);
      const classData = await TrainingService.updateClass(classId, payload);
      res.status(200).json({ success: true, message: 'Class updated successfully', data: classData });
    } catch (error) {
      next(error);
    }
  }

  static async deleteClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classId = requireId(req.params.id, 'Class');
      await TrainingService.deleteClass(classId);
      res.status(200).json({ success: true, message: 'Class deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async enrollInClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classId = requireId(req.params.id, 'Class');
      const userId = requireUserId(req);
      const enrollment = await TrainingService.enrollInClass(classId, userId);
      res.status(201).json({ success: true, message: 'Enrolled successfully', data: enrollment });
    } catch (error) {
      next(error);
    }
  }

  static async getExams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const classId = parseOptionalString(req.query.classId);
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await TrainingService.getExams(classId, page, limit);
      res.status(200).json({ success: true, data: result.exams, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getExamById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const exam = await TrainingService.getExamById(examId);
      if (!exam) throw new CustomError('Exam not found', 404);
      res.status(200).json({ success: true, data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async createExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreateExamPayload(req.body);
      const exam = await TrainingService.createExam(payload);
      res.status(201).json({ success: true, message: 'Exam created successfully', data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async updateExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const payload = parseUpdateExamPayload(req.body);
      const exam = await TrainingService.updateExam(examId, payload);
      res.status(200).json({ success: true, message: 'Exam updated successfully', data: exam });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      await TrainingService.deleteExam(examId);
      res.status(200).json({ success: true, message: 'Exam deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async submitExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examId = requireId(req.params.id, 'Exam');
      const userId = requireUserId(req);
      const answers = req.body?.answers ?? [];
      if (!Array.isArray(answers)) {
        throw new CustomError('answers must be an array', 400);
      }
      const submission = await TrainingService.submitExam(examId, userId, answers);
      res.status(201).json({ success: true, message: 'Exam submitted successfully', data: submission });
    } catch (error) {
      next(error);
    }
  }

  static async getCertifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await TrainingService.getCertifications(page, limit);
      res.status(200).json({ success: true, data: result.certifications, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getCertificationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificationId = requireId(req.params.id, 'Certification');
      const cert = await TrainingService.getCertificationById(certificationId);
      if (!cert) throw new CustomError('Certification not found', 404);
      res.status(200).json({ success: true, data: cert });
    } catch (error) {
      next(error);
    }
  }

  static async createCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreateCertificationPayload(req.body);
      const cert = await TrainingService.createCertification(payload);
      res.status(201).json({ success: true, message: 'Certification created successfully', data: cert });
    } catch (error) {
      next(error);
    }
  }

  static async updateCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificationId = requireId(req.params.id, 'Certification');
      const payload = parseUpdateCertificationPayload(req.body);
      const cert = await TrainingService.updateCertification(certificationId, payload);
      res.status(200).json({ success: true, message: 'Certification updated successfully', data: cert });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCertification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const certificationId = requireId(req.params.id, 'Certification');
      await TrainingService.deleteCertification(certificationId);
      res.status(200).json({ success: true, message: 'Certification deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

