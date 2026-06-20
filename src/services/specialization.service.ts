import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

type SpecializationType = 'SPECIALIST' | 'THERAPIST';

export type Specialization = {
  id: string;
  name: string;
  type: SpecializationType;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateSpecializationData {
  name: string;
  type: SpecializationType;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateSpecializationData extends Partial<CreateSpecializationData> {}

export class SpecializationService {
  static async createSpecialization(data: CreateSpecializationData): Promise<Specialization> {
    // Check if specialization with same name and type already exists
    const existing = await (prisma as any).specialization.findFirst({
      where: {
        name: data.name,
        type: data.type,
      },
    });

    if (existing) {
      throw new CustomError(
        `Specialization "${data.name}" already exists for type ${data.type}`,
        409
      );
    }

    const createData: any = {
      name: data.name,
      type: data.type,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
    };
    
    if (data.description !== undefined && data.description !== null && data.description !== '') {
      createData.description = data.description;
    }
    
    const specialization = await (prisma as any).specialization.create({
      data: createData,
    });

    logger.info('Specialization created', { specializationId: specialization.id, type: data.type });
    return specialization;
  }

  static async getSpecializations(type?: SpecializationType): Promise<Specialization[]> {
    const where: any = { isActive: true };
    if (type) {
      where.type = type;
    }

    return (prisma as any).specialization.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    }) as Promise<Specialization[]>;
  }

  static async getAllSpecializations(type?: SpecializationType): Promise<Specialization[]> {
    const where: any = {};
    if (type) {
      where.type = type;
    }

    return (prisma as any).specialization.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    }) as Promise<Specialization[]>;
  }

  static async getSpecializationById(id: string): Promise<Specialization | null> {
    return (prisma as any).specialization.findUnique({
      where: { id },
    }) as Promise<Specialization | null>;
  }

  static async updateSpecialization(
    id: string,
    data: UpdateSpecializationData
  ): Promise<Specialization> {
    const updates: any = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.description !== undefined) updates.description = data.description ?? null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder;

    // Check for duplicate if name or type is being updated
    if (data.name !== undefined || data.type !== undefined) {
      const current = await (prisma as any).specialization.findUnique({ where: { id } });
      if (!current) throw new CustomError('Specialization not found', 404);

      const newName = data.name ?? current.name;
      const newType = data.type ?? current.type;

      const existing = await (prisma as any).specialization.findFirst({
        where: {
          name: newName,
          type: newType,
        },
      });

      if (existing && existing.id !== id) {
        throw new CustomError(
          `Specialization "${newName}" already exists for type ${newType}`,
          409
        );
      }
    }

    return (prisma as any).specialization.update({
      where: { id },
      data: updates,
    }) as Promise<Specialization>;
  }

  static async deleteSpecialization(id: string): Promise<void> {
    // Soft delete by setting isActive to false
    await (prisma as any).specialization.update({
      where: { id },
      data: { isActive: false },
    });
  }

  static async hardDeleteSpecialization(id: string): Promise<void> {
    await (prisma as any).specialization.delete({
      where: { id },
    });
  }
}
