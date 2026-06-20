import { Request, Response, NextFunction } from 'express';
import { NurseApplicationStatus } from '@prisma/client';
import { ApplicationService, PublicApplicationInput } from '../services/application.service';
import {
  publicApplicationSchema,
  bookInterviewSchema,
  interviewResultSchema,
  listApplicationsSchema,
  BookInterviewInput,
  InterviewResultInput,
  ListApplicationsQuery,
} from '../validators/application.validator';
import { validateBody, validateQuery } from '../validators/user.validator';

export class ApplicationController {
  static async submitPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawBody = { ...req.body } as Record<string, unknown>;
      if (rawBody.experience === '') {
        delete rawBody.experience;
      } else if (rawBody.experience !== undefined && rawBody.experience !== null) {
        const parsedExperience = Number(rawBody.experience);
        if (!Number.isNaN(parsedExperience)) {
          rawBody.experience = parsedExperience;
        }
      }
      if (rawBody.qualificationDriveLink === '') {
        rawBody.qualificationDriveLink = null;
      }

      const data = validateBody<PublicApplicationInput>(publicApplicationSchema, rawBody);
      const payload: PublicApplicationInput = {
        name: data.name,
        email: data.email,
        phone: data.phone,
      };
      if (data.licenseNumber) payload.licenseNumber = data.licenseNumber;
      if (data.experience !== undefined) payload.experience = data.experience;
      if (data.message) payload.message = data.message;
      if (data.qualificationDriveLink) payload.qualificationDriveLink = data.qualificationDriveLink;

      const files = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : req.file
          ? [req.file as Express.Multer.File]
          : [];

      const result = await ApplicationService.submitPublicApplication(payload, files);

      res.status(201).json({
        success: true,
        message: 'Application submitted. Your account has been created.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const application = await ApplicationService.getMyApplication(userId);
      res.status(200).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }

  static async bookInterview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = validateBody<BookInterviewInput>(bookInterviewSchema, req.body);
      const scheduledAt =
        data.scheduledAt instanceof Date ? data.scheduledAt.toISOString() : String(data.scheduledAt);
      const application = await ApplicationService.bookInterview(userId, { scheduledAt });
      res.status(200).json({
        success: true,
        message: 'Physical interview booked successfully',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<ListApplicationsQuery>(listApplicationsSchema, req.query);
      const listFilters: {
        status?: NurseApplicationStatus;
        page?: number;
        limit?: number;
      } = {};
      if (filters.status) listFilters.status = filters.status;
      if (filters.page !== undefined) listFilters.page = filters.page;
      if (filters.limit !== undefined) listFilters.limit = filters.limit;
      const result = await ApplicationService.listApplications(listFilters);
      res.status(200).json({ success: true, data: result.applications, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async recordInterviewResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const applicationId = req.params.id;
      if (!applicationId) {
        res.status(400).json({ success: false, message: 'Application ID is required' });
        return;
      }
      const data = validateBody<InterviewResultInput>(interviewResultSchema, req.body);
      const application = await ApplicationService.recordInterviewResult(
        applicationId,
        req.user!.userId,
        data.passed,
        data.notes || undefined
      );
      res.status(200).json({
        success: true,
        message: data.passed ? 'Candidate certified — pending recruitment' : 'Interview marked as failed',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }

  static async markRecruited(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const applicationId = req.params.id;
      if (!applicationId) {
        res.status(400).json({ success: false, message: 'Application ID is required' });
        return;
      }
      const application = await ApplicationService.markRecruited(applicationId, req.user!.userId);
      res.status(200).json({
        success: true,
        message: 'Candidate recruited — patient access granted',
        data: application,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ApplicationController;
