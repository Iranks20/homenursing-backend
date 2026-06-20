import { Prisma, Service } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CreateServiceData {
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  features?: string[];
  image?: string;
}

export interface ServiceFilters {
  query?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface UpdateServiceData extends Partial<CreateServiceData> {
  isActive?: boolean;
}

export class ServiceService {
  static async createService(data: CreateServiceData): Promise<Service> {
    const existing = await prisma.service.findFirst({ where: { name: data.name } });
    if (existing) {
      throw new CustomError('Service with this name already exists', 409);
    }

    const service = await prisma.service.create({
      data,
    });

    logger.info('Service created', { serviceId: service.id });
    return service;
  }

  static async getServiceById(id: string): Promise<Service | null> {
    return prisma.service.findUnique({
      where: { id },
      include: {
        appointments: true,
      }
    });
  }

  static async getServices(filters: ServiceFilters = {}) {
    const { query, category, isActive, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {};
    
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    where.isActive = isActive ?? true;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.service.count({ where })
    ]);

    return {
      services,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  static async updateService(id: string, data: UpdateServiceData): Promise<Service> {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Service not found', 404);
    }

    return prisma.service.update({
      where: { id },
      data,
    });
  }

  static async deleteService(id: string): Promise<void> {
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Service not found', 404);
    }

    await prisma.service.update({
      where: { id },
      data: { isActive: false }
    });
  }
}

