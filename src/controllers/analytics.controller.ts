import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { UserRole } from '@prisma/client';

export class AnalyticsController {
  static async getDashboardAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userRoleString = req.user?.role;
      // Convert string role to UserRole enum
      const userRole = userRoleString ? (userRoleString.toUpperCase() as UserRole) : undefined;
      const analytics = await AnalyticsService.getDashboardAnalytics(userId, userRole);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getAppointmentAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analytics = await AnalyticsService.getAppointmentAnalytics(startDate, endDate);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getRevenueAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analytics = await AnalyticsService.getRevenueAnalytics(startDate, endDate);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await AnalyticsService.getPatientAnalytics();
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getNurseAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await AnalyticsService.getNurseAnalytics();
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AnalyticsService.getOverview();
      res.status(200).json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }

  static async getTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const trends = await AnalyticsService.getTrends(startDate, endDate);
      res.status(200).json({ success: true, data: trends });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const performance = await AnalyticsService.getPerformance();
      res.status(200).json({ success: true, data: performance });
    } catch (error) {
      next(error);
    }
  }

  static async getServicePopularity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const popularity = await AnalyticsService.getServicePopularity();
      res.status(200).json({ success: true, data: popularity });
    } catch (error) {
      next(error);
    }
  }
}

