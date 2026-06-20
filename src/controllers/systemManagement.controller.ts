import { Request, Response, NextFunction } from 'express';
import { SystemManagementService, AuditLogFilters, LoginAttemptFilters } from '../services/systemManagement.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireUserId = (req: Request, fallback?: string): string => {
  const userId = fallback ?? (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) {
    throw new CustomError('User ID is required', 400);
  }
  return userId;
};

const parseAuditLogFilters = (query: Request['query']): AuditLogFilters => {
  const filters: AuditLogFilters = {};
  if (query.userId) filters.userId = String(query.userId);
  if (query.action) filters.action = String(query.action);
  if (query.startDate) filters.startDate = String(query.startDate);
  if (query.endDate) filters.endDate = String(query.endDate);
  return filters;
};

const parseLoginAttemptFilters = (query: Request['query']): LoginAttemptFilters => {
  const filters: LoginAttemptFilters = {};
  if (query.userId) filters.userId = String(query.userId);
  if (query.startDate) filters.startDate = String(query.startDate);
  if (query.endDate) filters.endDate = String(query.endDate);
  if (query.success !== undefined) filters.success = String(query.success).toLowerCase() === 'true';
  return filters;
};

export class SystemManagementController {
  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 50);
      const filters = parseAuditLogFilters(req.query);
      const result = await SystemManagementService.getAuditLogs(filters, page, limit);
      res.status(200).json({ success: true, data: result.logs, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getUserActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req, req.params.userId);
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 50);
      const result = await SystemManagementService.getUserActivities(userId, page, limit);
      res.status(200).json({ success: true, data: result.activities, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getLoginAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 50);
      const filters = parseLoginAttemptFilters(req.query);
      const result = await SystemManagementService.getLoginAttempts(filters, page, limit);
      res.status(200).json({ success: true, data: result.attempts, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async exportAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = parseAuditLogFilters(req.body ?? {});
      const result = await SystemManagementService.exportAuditLogs(filters);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getAppConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await SystemManagementService.getAppConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  static async updateAppConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await SystemManagementService.updateAppConfig(req.body ?? {});
      res.status(200).json({ success: true, message: 'Configuration updated', data: config });
    } catch (error) {
      next(error);
    }
  }

  static async getFeatureFlags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const flags = await SystemManagementService.getFeatureFlags();
      res.status(200).json({ success: true, data: flags });
    } catch (error) {
      next(error);
    }
  }

  static async updateFeatureFlags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const flags = await SystemManagementService.updateFeatureFlags(req.body ?? {});
      res.status(200).json({ success: true, message: 'Feature flags updated', data: flags });
    } catch (error) {
      next(error);
    }
  }

  static async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SystemManagementService.createBackup();
      res.status(201).json({ success: true, message: 'Backup created', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async restoreBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { backupId } = req.body ?? {};
      if (!backupId) throw new CustomError('Backup ID is required', 400);
      const result = await SystemManagementService.restoreBackup(String(backupId));
      res.status(200).json({ success: true, message: 'Restore initiated', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const format = (req.query.format as string) ?? 'json';
      const result = await SystemManagementService.exportData(format);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async importData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SystemManagementService.importData(req.body);
      res.status(200).json({ success: true, message: 'Import initiated', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getCleanupRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SystemManagementService.getCleanupRecommendations();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

