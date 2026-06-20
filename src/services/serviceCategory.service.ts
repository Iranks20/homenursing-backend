import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceCategoryData {
  name: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdateServiceCategoryData extends Partial<CreateServiceCategoryData> {}

export class ServiceCategoryService {
  static async createCategory(data: CreateServiceCategoryData): Promise<ServiceCategory> {
    const existing = await (prisma as any).serviceCategoryModel.findFirst({
      where: { name: data.name },
    });

    if (existing) {
      throw new CustomError(`Service category "${data.name}" already exists`, 409);
    }

    const createData: any = {
      name: data.name,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
    };

    if (data.description !== undefined && data.description !== null && data.description !== '') {
      createData.description = data.description;
    }

    const category = await (prisma as any).serviceCategoryModel.create({
      data: createData,
    });

    logger.info('Service category created', { categoryId: category.id });
    return category;
  }

  static async getCategories(includeInactive = false): Promise<ServiceCategory[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return (prisma as any).serviceCategoryModel.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    }) as Promise<ServiceCategory[]>;
  }

  static async getCategoryById(id: string): Promise<ServiceCategory | null> {
    return (prisma as any).serviceCategoryModel.findUnique({
      where: { id },
    }) as Promise<ServiceCategory | null>;
  }

  static async updateCategory(id: string, data: UpdateServiceCategoryData): Promise<ServiceCategory> {
    const updates: any = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description ?? null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder;

    if (data.name !== undefined) {
      const existing = await (prisma as any).serviceCategoryModel.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new CustomError(`Service category "${data.name}" already exists`, 409);
      }
    }

    const category = await (prisma as any).serviceCategoryModel.update({
      where: { id },
      data: updates,
    });

    logger.info('Service category updated', { categoryId: id });
    return category;
  }

  static async deleteCategory(id: string): Promise<void> {
    const existing = await (prisma as any).serviceCategoryModel.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new CustomError('Service category not found', 404);
    }

    await (prisma as any).serviceCategoryModel.delete({
      where: { id },
    });

    logger.info('Service category deleted', { categoryId: id });
  }
}

