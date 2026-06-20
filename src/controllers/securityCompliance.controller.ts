import { Request, Response, NextFunction } from 'express';
import { SecurityComplianceService } from '../services/securityCompliance.service';
import { CustomError } from '../middleware/error.middleware';

export class SecurityComplianceController {
  static async getSecurityPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policies = await SecurityComplianceService.getSecurityPolicies();
      res.status(200).json({ success: true, data: policies });
    } catch (error) {
      next(error);
    }
  }

  static async updateSecurityPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policies = await SecurityComplianceService.updateSecurityPolicies(req.body);
      res.status(200).json({ success: true, message: 'Security policies updated', data: policies });
    } catch (error) {
      next(error);
    }
  }

  static async getSecurityIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await SecurityComplianceService.getSecurityIncidents(page, limit);
      res.status(200).json({ success: true, data: result.incidents, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async reportSecurityIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const incident = await SecurityComplianceService.reportSecurityIncident({
        ...req.body,
        userId,
      });
      res.status(201).json({ success: true, message: 'Incident reported', data: incident });
    } catch (error) {
      next(error);
    }
  }

  static async getComplianceAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const audit = await SecurityComplianceService.getComplianceAudit(req.query as any);
      res.status(200).json({ success: true, data: audit });
    } catch (error) {
      next(error);
    }
  }

  static async getDataPrivacyRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await SecurityComplianceService.getDataPrivacyRequests(page, limit);
      res.status(200).json({ success: true, data: result.requests, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async exportUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId || req.user?.userId;
      if (!userId) throw new CustomError('User ID is required', 400);
      const result = await SecurityComplianceService.exportUserData(userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId || req.user?.userId;
      if (!userId) throw new CustomError('User ID is required', 400);
      const result = await SecurityComplianceService.deleteUserData(userId);
      res.status(200).json({ success: true, message: 'Data deletion requested', data: result });
    } catch (error) {
      next(error);
    }
  }
}

