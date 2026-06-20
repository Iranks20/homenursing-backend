import { NurseApplicationStatus } from '@prisma/client';
import Joi from 'joi';

export const publicApplicationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(8).max(20).required(),
  licenseNumber: Joi.string().max(100).optional().allow('', null),
  experience: Joi.number().integer().min(0).max(60).optional().empty('').allow(null),
  message: Joi.string().max(2000).optional().allow('', null),
  qualificationDriveLink: Joi.string().max(500).optional().allow('', null),
});

export const bookInterviewSchema = Joi.object({
  scheduledAt: Joi.date().iso().required(),
});

export const interviewResultSchema = Joi.object({
  passed: Joi.boolean().required(),
  notes: Joi.string().max(2000).optional().allow('', null),
});

export const listApplicationsSchema = Joi.object({
  status: Joi.string()
    .valid(
      'EXAM_PENDING',
      'EXAM_FAILED',
      'EXAM_PASSED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_PASSED',
      'INTERVIEW_FAILED',
      'CERTIFIED',
      'RECRUITED'
    )
    .optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export interface PublicApplicationInput {
  name: string;
  email: string;
  phone: string;
  licenseNumber?: string | null;
  experience?: number;
  message?: string | null;
  qualificationDriveLink?: string | null;
}

export interface BookInterviewInput {
  scheduledAt: Date | string;
}

export interface InterviewResultInput {
  passed: boolean;
  notes?: string | null;
}

export interface ListApplicationsQuery {
  status?: NurseApplicationStatus;
  page?: number;
  limit?: number;
}
