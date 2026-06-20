import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface PaymentMethodSetting {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentMethodData {
  name: string;
  description?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface UpdatePaymentMethodData extends Partial<CreatePaymentMethodData> {}

export class PaymentMethodService {
  static async getPaymentMethods(includeInactive = false): Promise<PaymentMethodSetting[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    return (prisma as any).paymentMethodModel.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }) as Promise<PaymentMethodSetting[]>;
  }

  static async getPaymentMethodById(id: string): Promise<PaymentMethodSetting | null> {
    return (prisma as any).paymentMethodModel.findUnique({
      where: { id },
    }) as Promise<PaymentMethodSetting | null>;
  }

  static async createPaymentMethod(data: CreatePaymentMethodData): Promise<PaymentMethodSetting> {
    const existing = await (prisma as any).paymentMethodModel.findFirst({
      where: { name: data.name },
    });

    if (existing) {
      throw new CustomError(`Payment method "${data.name}" already exists`, 409);
    }

    const createData: any = {
      name: data.name,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
    };

    if (data.description !== undefined && data.description !== null && data.description !== '') {
      createData.description = data.description;
    }

    const method = await (prisma as any).paymentMethodModel.create({
      data: createData,
    });

    logger.info('Payment method created', { paymentMethodId: method.id });
    return method;
  }

  static async updatePaymentMethod(
    id: string,
    data: UpdatePaymentMethodData
  ): Promise<PaymentMethodSetting> {
    const updates: any = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description ?? null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.displayOrder !== undefined) updates.displayOrder = data.displayOrder;

    if (data.name !== undefined) {
      const existing = await (prisma as any).paymentMethodModel.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new CustomError(`Payment method "${data.name}" already exists`, 409);
      }
    }

    const method = await (prisma as any).paymentMethodModel.update({
      where: { id },
      data: updates,
    });

    logger.info('Payment method updated', { paymentMethodId: id });
    return method;
  }

  static async deletePaymentMethod(id: string): Promise<void> {
    const existing = await (prisma as any).paymentMethodModel.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new CustomError('Payment method not found', 404);
    }

    await (prisma as any).paymentMethodModel.delete({
      where: { id },
    });

    logger.info('Payment method deleted', { paymentMethodId: id });
  }
}

