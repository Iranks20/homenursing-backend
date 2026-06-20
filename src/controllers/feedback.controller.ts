import { Request, Response, NextFunction } from 'express';
import { FeedbackService, CreateFeedbackData } from '../services/feedback.service';
import {
  validateBody,
  createFeedbackSchema,
  updateFeedbackSchema,
} from '../validators/feedback.validator';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireId = (id: string | undefined, resource = 'Feedback'): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

export class FeedbackController {
  static async getFeedbacks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await FeedbackService.getFeedbacks(page, limit);

      res.status(200).json({
        success: true,
        data: result.feedbacks,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFeedbackById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feedbackId = requireId(req.params.id);
      const feedback = await FeedbackService.getFeedbackById(feedbackId);
      if (!feedback) throw new CustomError('Feedback not found', 404);
      res.status(200).json({ success: true, data: feedback });
    } catch (error) {
      next(error);
    }
  }

  static async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<CreateFeedbackData>(createFeedbackSchema, req.body);
      const feedback = await FeedbackService.createFeedback(data);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: feedback,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feedbackId = requireId(req.params.id);
      const data = validateBody<Partial<CreateFeedbackData>>(updateFeedbackSchema, req.body);
      const feedback = await FeedbackService.updateFeedback(feedbackId, data);

      res.status(200).json({
        success: true,
        message: 'Feedback updated successfully',
        data: feedback,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feedbackId = requireId(req.params.id);
      await FeedbackService.deleteFeedback(feedbackId);
      res.status(200).json({
        success: true,
        message: 'Feedback deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientFeedbacks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireId(req.params.patientId, 'Patient');
      const feedbacks = await FeedbackService.getPatientFeedbacks(patientId);
      res.status(200).json({ success: true, data: feedbacks });
    } catch (error) {
      next(error);
    }
  }

  static async getServiceFeedbacks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = requireId(req.params.serviceId, 'Service');
      const feedbacks = await FeedbackService.getServiceFeedbacks(serviceId);
      res.status(200).json({ success: true, data: feedbacks });
    } catch (error) {
      next(error);
    }
  }
}

