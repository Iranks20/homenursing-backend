import { Request, Response, NextFunction } from 'express';
import { PayFrequency, UserRole } from '@prisma/client';
import StaffPaymentService from '../services/staffPayment.service';
import { validateQuery } from '../validators/user.validator';
import Joi from 'joi';

const listStaffPaymentsSchema = Joi.object({
  role: Joi.string().valid('NURSE', 'SUPERVISOR').optional(),
  payFrequency: Joi.string().valid('WEEKLY', 'MONTHLY').optional(),
});

export class StaffPaymentController {
  static async listSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = validateQuery<{ role?: UserRole; payFrequency?: PayFrequency }>(
        listStaffPaymentsSchema,
        req.query
      );
      const schedules = await StaffPaymentService.listSchedules(filters);
      res.status(200).json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }
}

export default StaffPaymentController;
