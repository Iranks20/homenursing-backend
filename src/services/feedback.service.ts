import { Feedback } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CreateFeedbackData {
  patientId: string;
  serviceId: string;
  specialistId?: string;
  rating: number;
  comment?: string;
  professionalism: number;
  punctuality: number;
  communication: number;
  careQuality: number;
  isPublic?: boolean;
}

export class FeedbackService {
  static async createFeedback(data: CreateFeedbackData): Promise<Feedback> {
    const feedback = await prisma.feedback.create({
      data,
      include: {
        patient: true,
      }
    });

    logger.info('Feedback created', { feedbackId: feedback.id });
    return feedback;
  }

  static async getFeedbackById(id: string): Promise<Feedback | null> {
    return prisma.feedback.findUnique({
      where: { id },
      include: {
        patient: true,
      }
    });
  }

  static async getFeedbacks(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          patient: true,
        }
      }),
      prisma.feedback.count()
    ]);

    return {
      feedbacks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  static async getPatientFeedbacks(patientId: string) {
    return prisma.feedback.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  static async getServiceFeedbacks(serviceId: string) {
    return prisma.feedback.findMany({
      where: { serviceId },
      orderBy: { date: 'desc' },
      include: {
        patient: true,
      }
    });
  }

  static async updateFeedback(id: string, data: Partial<CreateFeedbackData>): Promise<Feedback> {
    return prisma.feedback.update({
      where: { id },
      data,
    });
  }

  static async deleteFeedback(id: string): Promise<void> {
    await prisma.feedback.delete({
      where: { id }
    });
  }
}

