import { Request, Response, NextFunction } from 'express';
import {
  PaymentMethodService,
  CreatePaymentMethodData,
  UpdatePaymentMethodData,
} from '../services/paymentMethod.service';
import { CustomError } from '../middleware/error.middleware';

const requireId = (id: string | undefined): string => {
  if (!id) {
    throw new CustomError('Payment method ID is required', 400);
  }
  return id;
};

const parseCreatePayload = (body: unknown): CreatePaymentMethodData => {
  const data = body as Record<string, unknown>;
  const required = <T>(value: T | undefined, name: string): T => {
    if (value === undefined || value === null || value === '') {
      throw new CustomError(`${name} is required`, 400);
    }
    return value;
  };

  const result: CreatePaymentMethodData = {
    name: required(data.name as string | undefined, 'name'),
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : 0,
  };

  if (data.description !== undefined && data.description !== null && data.description !== '') {
    result.description = data.description as string;
  }

  return result;
};

const parseUpdatePayload = (body: unknown): UpdatePaymentMethodData => {
  const data = body as Record<string, unknown>;
  const payload: UpdatePaymentMethodData = {};

  if (data.name !== undefined) payload.name = data.name as string;
  if (data.description !== undefined) payload.description = data.description as string;
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.displayOrder !== undefined) payload.displayOrder = Number(data.displayOrder);

  return payload;
};

export class PaymentMethodController {
  static async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const methods = await PaymentMethodService.getPaymentMethods(includeInactive);
      res.status(200).json({ success: true, data: methods });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMethodById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const method = await PaymentMethodService.getPaymentMethodById(id);
      if (!method) {
        throw new CustomError('Payment method not found', 404);
      }
      res.status(200).json({ success: true, data: method });
    } catch (error) {
      next(error);
    }
  }

  static async createPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = parseCreatePayload(req.body);
      const method = await PaymentMethodService.createPaymentMethod(payload);
      res.status(201).json({
        success: true,
        message: 'Payment method created successfully',
        data: method,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      const payload = parseUpdatePayload(req.body);
      const method = await PaymentMethodService.updatePaymentMethod(id, payload);
      res.status(200).json({
        success: true,
        message: 'Payment method updated successfully',
        data: method,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deletePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireId(req.params.id);
      await PaymentMethodService.deletePaymentMethod(id);
      res.status(200).json({ success: true, message: 'Payment method deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

