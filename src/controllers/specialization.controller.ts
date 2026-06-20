import { Request, Response, NextFunction } from 'express';
import { SpecializationService, CreateSpecializationData, UpdateSpecializationData } from '../services/specialization.service';
import { CustomError } from '../middleware/error.middleware';

type SpecializationType = 'SPECIALIST' | 'THERAPIST';

const requireId = (id: string | undefined): string => {
  if (!id) {
    throw new CustomError('Specialization ID is required', 400);
  }
  return id;
};

const parseCreatePayload = (body: unknown): CreateSpecializationData => {
  const data = body as Record<string, unknown>;
  const required = <T>(value: T | undefined, name: string): T => {
    if (value === undefined || value === null || value === '') {
      throw new CustomError(`${name} is required`, 400);
    }
    return value;
  };

  const type = required(data.type as string | undefined, 'type').toUpperCase();
  if (type !== 'SPECIALIST' && type !== 'THERAPIST') {
    throw new CustomError('Type must be either SPECIALIST or THERAPIST', 400);
  }

  const result: CreateSpecializationData = {
    name: required(data.name as string | undefined, 'name'),
    type: type as SpecializationType,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : 0,
  };
  
  if (data.description !== undefined && data.description !== null && data.description !== '') {
    result.description = data.description as string;
  }
  
  return result;
};

const parseUpdatePayload = (body: unknown): UpdateSpecializationData => {
  const data = body as Record<string, unknown>;
  const payload: UpdateSpecializationData = {};

  if (data.name !== undefined) payload.name = data.name as string;
  if (data.type !== undefined) {
    const type = (data.type as string).toUpperCase();
    if (type !== 'SPECIALIST' && type !== 'THERAPIST') {
      throw new CustomError('Type must be either SPECIALIST or THERAPIST', 400);
    }
    payload.type = type as SpecializationType;
  }
  if (data.description !== undefined) payload.description = data.description as string;
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.displayOrder !== undefined) payload.displayOrder = Number(data.displayOrder);

  return payload;
};

export class SpecializationController {
  static async getSpecializations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.query.type as string | undefined;
      const includeInactive = req.query.includeInactive === 'true';
      const specializationType = type ? (type.toUpperCase() as SpecializationType) : undefined;

      const specializations = includeInactive
        ? await SpecializationService.getAllSpecializations(specializationType)
        : await SpecializationService.getSpecializations(specializationType);

      res.status(200).json({ success: true, data: specializations });
    } catch (error) {
      next(error);
    }
  }

  static async getSpecializationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const specialization = await SpecializationService.getSpecializationById(id);
      if (!specialization) throw new CustomError('Specialization not found', 404);
      res.status(200).json({ success: true, data: specialization });
    } catch (error) {
      next(error);
    }
  }

  static async createSpecialization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreatePayload(req.body);
      const specialization = await SpecializationService.createSpecialization(payload);
      res.status(201).json({
        success: true,
        message: 'Specialization created successfully',
        data: specialization,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSpecialization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const payload = parseUpdatePayload(req.body);
      const specialization = await SpecializationService.updateSpecialization(id, payload);
      res.status(200).json({
        success: true,
        message: 'Specialization updated successfully',
        data: specialization,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSpecialization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      await SpecializationService.deleteSpecialization(id);
      res.status(200).json({ success: true, message: 'Specialization deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
