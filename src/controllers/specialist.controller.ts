import { Request, Response, NextFunction } from 'express';
import { SpecialistStatus } from '@prisma/client';
import { SpecialistService, CreateSpecialistData, UpdateSpecialistData } from '../services/specialist.service';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireId = (id: string | undefined): string => {
  if (!id) {
    throw new CustomError('Specialist ID is required', 400);
  }
  return id;
};

const optionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).trim() || undefined;
};
const optionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

const parseCreatePayload = (body: unknown): CreateSpecialistData => {
  const data = body as Record<string, unknown>;
  const required = <T>(value: T | undefined, name: string): T => {
    if (value === undefined || value === null || value === '') {
      throw new CustomError(`${name} is required`, 400);
    }
    return value;
  };

  const payload: CreateSpecialistData = {
    username: required(data.username as string | undefined, 'username'),
    name: required(data.name as string | undefined, 'name'),
    password: required(data.password as string | undefined, 'password'),
    phone: required(data.phone as string | undefined, 'phone'),
    specialization: required(data.specialization as string | undefined, 'specialization'),
    experience: Number(required(data.experience as number | undefined, 'experience')),
    hireDate: new Date(required(data.hireDate as Date | string | undefined, 'hireDate')),
    email: optionalString(data.email) ?? null,
    licenseNumber: optionalString(data.licenseNumber) ?? null,
    hourlyRate: optionalNumber(data.hourlyRate) ?? null,
  };

  if (data.certifications !== undefined) payload.certifications = data.certifications as string[];
  if (data.bio !== undefined) payload.bio = data.bio as string;
  if (data.avatar !== undefined) payload.avatar = data.avatar as string;
  if (data.dateOfBirth !== undefined && data.dateOfBirth !== '') {
    payload.dateOfBirth = new Date(data.dateOfBirth as Date | string);
  }

  return payload;
};

const parseUpdatePayload = (body: unknown): UpdateSpecialistData => {
  const data = body as Record<string, unknown>;
  const payload: UpdateSpecialistData = {};

  if (data.username !== undefined) payload.username = data.username as string;
  if (data.name !== undefined) payload.name = data.name as string;
  if (data.email !== undefined) payload.email = data.email as string;
  if (data.phone !== undefined) payload.phone = data.phone as string;
  if (data.licenseNumber !== undefined) payload.licenseNumber = data.licenseNumber as string;
  if (data.specialization !== undefined) payload.specialization = data.specialization as string;
  if (data.experience !== undefined) payload.experience = Number(data.experience);
  if (data.certifications !== undefined) payload.certifications = data.certifications as string[];
  if (data.hourlyRate !== undefined) payload.hourlyRate = Number(data.hourlyRate);
  if (data.bio !== undefined) payload.bio = data.bio as string;
  if (data.hireDate !== undefined) payload.hireDate = new Date(data.hireDate as Date | string);
  if (data.dateOfBirth !== undefined) {
    payload.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth as Date | string) : null;
  }
  if (data.avatar !== undefined) payload.avatar = data.avatar as string;
  if (data.status !== undefined) payload.status = SpecialistStatus[data.status as keyof typeof SpecialistStatus];

  return payload;
};

export class SpecialistController {
  static async getSpecialists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await SpecialistService.getSpecialists(page, limit);
      res.status(200).json({ success: true, data: result.specialists, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getSpecialistById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const specialistId = requireId(req.params.id);
      const specialist = await SpecialistService.getSpecialistDetailsById(specialistId);
      if (!specialist) throw new CustomError('Specialist not found', 404);
      res.status(200).json({ success: true, data: specialist });
    } catch (error) {
      next(error);
    }
  }

  static async createSpecialist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreatePayload(req.body);
      const specialist = await SpecialistService.createSpecialist(payload);
      res.status(201).json({ success: true, message: 'Specialist created successfully', data: specialist });
    } catch (error) {
      next(error);
    }
  }

  static async updateSpecialist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const specialistId = requireId(req.params.id);
      const payload = parseUpdatePayload(req.body);
      const specialist = await SpecialistService.updateSpecialist(specialistId, payload);
      res.status(200).json({ success: true, message: 'Specialist updated successfully', data: specialist });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSpecialist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const specialistId = requireId(req.params.id);
      await SpecialistService.deleteSpecialist(specialistId);
      res.status(200).json({ success: true, message: 'Specialist deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

