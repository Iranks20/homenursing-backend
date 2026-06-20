import { Request, Response, NextFunction } from 'express';
import { NurseService, CreateNurseData, UpdateNurseData } from '../services/nurse.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireParamId = (id: string | undefined, resource: string): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

export class NurseController {
  static async getNurses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await NurseService.getNurses(page, limit);
      res.status(200).json({ success: true, data: result.nurses, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getNurseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nurseId = requireParamId(req.params.id, 'Nurse');
      const nurse = await NurseService.getNurseById(nurseId);
      if (!nurse) throw new CustomError('Nurse not found', 404);
      res.status(200).json({ success: true, data: nurse });
    } catch (error) {
      next(error);
    }
  }

  static async createNurse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nurse = await NurseService.createNurse(req.body as CreateNurseData);
      res.status(201).json({ success: true, message: 'Nurse created successfully', data: nurse });
    } catch (error) {
      next(error);
    }
  }

  static async updateNurse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nurseId = requireParamId(req.params.id, 'Nurse');
      const nurse = await NurseService.updateNurse(nurseId, req.body as UpdateNurseData);
      res.status(200).json({ success: true, message: 'Nurse updated successfully', data: nurse });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNurse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const nurseId = requireParamId(req.params.id, 'Nurse');
      await NurseService.deleteNurse(nurseId);
      res.status(200).json({ success: true, message: 'Nurse deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

