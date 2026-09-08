import { Request, Response, NextFunction } from 'express';
import {
  CreateVisitorData,
  UpdateVisitorData,
  VisitorService,
} from '../services/visitor.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireId = (id: string | undefined): string => {
  if (!id) throw new CustomError('Visitor ID is required', 400);
  return id;
};

const parseCreatePayload = (body: unknown): CreateVisitorData => {
  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name : '';
  const phone = typeof data.phone === 'string' ? data.phone : '';
  if (!name.trim()) throw new CustomError('name is required', 400);
  if (!phone.trim()) throw new CustomError('phone is required', 400);

  const payload: CreateVisitorData = { name, phone };
  if (data.email !== undefined) payload.email = data.email == null ? null : String(data.email);
  if (data.company !== undefined) payload.company = data.company == null ? null : String(data.company);
  if (data.purpose !== undefined) payload.purpose = data.purpose == null ? null : String(data.purpose);
  if (data.notes !== undefined) payload.notes = data.notes == null ? null : String(data.notes);
  if (data.visitedAt !== undefined) {
    payload.visitedAt = data.visitedAt == null ? null : String(data.visitedAt);
  }
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  return payload;
};

const parseUpdatePayload = (body: unknown): UpdateVisitorData => {
  const data = body as Record<string, unknown>;
  const payload: UpdateVisitorData = {};
  if (data.name !== undefined) payload.name = String(data.name);
  if (data.phone !== undefined) payload.phone = String(data.phone);
  if (data.email !== undefined) payload.email = data.email == null ? null : String(data.email);
  if (data.company !== undefined) payload.company = data.company == null ? null : String(data.company);
  if (data.purpose !== undefined) payload.purpose = data.purpose == null ? null : String(data.purpose);
  if (data.notes !== undefined) payload.notes = data.notes == null ? null : String(data.notes);
  if (data.visitedAt !== undefined) {
    payload.visitedAt = data.visitedAt == null ? null : String(data.visitedAt);
  }
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  return payload;
};

export class VisitorController {
  static async getVisitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: {
        page: number;
        limit: number;
        search?: string;
        includeInactive?: boolean;
      } = {
        page: parseNumber(req.query.page, 1),
        limit: parseNumber(req.query.limit, 50),
      };
      if (req.query.search) filters.search = String(req.query.search);
      if (req.query.includeInactive === 'true') filters.includeInactive = true;
      const result = await VisitorService.getVisitors(filters);
      res.status(200).json({
        success: true,
        data: result.visitors,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVisitorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visitor = await VisitorService.getVisitorById(requireId(req.params.id));
      if (!visitor) throw new CustomError('Visitor not found', 404);
      res.status(200).json({ success: true, data: visitor });
    } catch (error) {
      next(error);
    }
  }

  static async createVisitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visitor = await VisitorService.createVisitor(parseCreatePayload(req.body));
      res.status(201).json({
        success: true,
        message: 'Visitor registered successfully',
        data: visitor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateVisitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visitor = await VisitorService.updateVisitor(
        requireId(req.params.id),
        parseUpdatePayload(req.body)
      );
      res.status(200).json({
        success: true,
        message: 'Visitor updated successfully',
        data: visitor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteVisitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await VisitorService.deleteVisitor(requireId(req.params.id));
      res.status(200).json({
        success: true,
        message: 'Visitor deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
