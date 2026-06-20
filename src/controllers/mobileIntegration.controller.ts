import { Request, Response, NextFunction } from 'express';
import { MobileIntegrationService } from '../services/mobileIntegration.service';
import { CustomError } from '../middleware/error.middleware';

const requireUserId = (req: Request): string => {
  const userId = (req as Request & { user?: { id?: string; userId?: string } }).user?.id ?? (req as Request & { user?: { id?: string; userId?: string } }).user?.userId;
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

const parseOptionalDate = (value: unknown, field: string): Date | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${field} is invalid`, 400);
  }
  return date;
};

export class MobileIntegrationController {
  static async getMobileConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await MobileIntegrationService.getMobileConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  static async registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const token = parseString(req.body?.token, 'token');
      const platform = parseString(req.body?.platform, 'platform');

      const result = await MobileIntegrationService.registerPushToken(userId, token, platform);
      res.status(201).json({ success: true, message: 'Push token registered', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getOfflineSyncData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const lastSync = parseOptionalDate(req.query.lastSync, 'lastSync');
      const data = await MobileIntegrationService.getOfflineSyncData(userId, lastSync);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAvailableIntegrations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const integrations = await MobileIntegrationService.getAvailableIntegrations();
      res.status(200).json({ success: true, data: integrations });
    } catch (error) {
      next(error);
    }
  }

  static async connectIntegration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const integrationId = parseString(req.body?.integrationId, 'integrationId');
      const credentials = req.body?.credentials;

      const result = await MobileIntegrationService.connectIntegration(integrationId, credentials);
      res.status(201).json({ success: true, message: 'Integration connected', data: result });
    } catch (error) {
      next(error);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const integrationId = parseString(req.params.integrationId ?? req.body?.integrationId, 'integrationId');

      const result = await MobileIntegrationService.handleWebhook(integrationId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

