import { Request, Response, NextFunction } from 'express';
import {
  ServiceCategoryService,
  CreateServiceCategoryData,
  UpdateServiceCategoryData,
} from '../services/serviceCategory.service';
import { CustomError } from '../middleware/error.middleware';

const requireId = (id: string | undefined): string => {
  if (!id) {
    throw new CustomError('Service category ID is required', 400);
  }
  return id;
};

const parseCreatePayload = (body: unknown): CreateServiceCategoryData => {
  const data = body as Record<string, unknown>;
  const required = <T>(value: T | undefined, name: string): T => {
    if (value === undefined || value === null || value === '') {
      throw new CustomError(`${name} is required`, 400);
    }
    return value;
  };

  const result: CreateServiceCategoryData = {
    name: required(data.name as string | undefined, 'name'),
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : 0,
  };

  if (data.description !== undefined && data.description !== null && data.description !== '') {
    result.description = data.description as string;
  }

  return result;
};

const parseUpdatePayload = (body: unknown): UpdateServiceCategoryData => {
  const data = body as Record<string, unknown>;
  const payload: UpdateServiceCategoryData = {};

  if (data.name !== undefined) payload.name = data.name as string;
  if (data.description !== undefined) payload.description = data.description as string;
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.displayOrder !== undefined) payload.displayOrder = Number(data.displayOrder);

  return payload;
};

export class ServiceCategoryController {
  static async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await ServiceCategoryService.getCategories(includeInactive);
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const category = await ServiceCategoryService.getCategoryById(id);
      if (!category) throw new CustomError('Service category not found', 404);
      res.status(200).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreatePayload(req.body);
      const category = await ServiceCategoryService.createCategory(payload);
      res.status(201).json({
        success: true,
        message: 'Service category created successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const payload = parseUpdatePayload(req.body);
      const category = await ServiceCategoryService.updateCategory(id, payload);
      res.status(200).json({
        success: true,
        message: 'Service category updated successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      await ServiceCategoryService.deleteCategory(id);
      res.status(200).json({ success: true, message: 'Service category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

