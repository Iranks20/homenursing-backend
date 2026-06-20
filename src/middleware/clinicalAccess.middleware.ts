import { Request, Response, NextFunction } from 'express';
import { NurseApplicationStatus } from '@prisma/client';
import prisma from '../config/database';
import { CustomError } from './error.middleware';

export async function hasClinicalAccess(userId: string, role: string): Promise<boolean> {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === 'ADMIN') {
    return true;
  }
  if (normalizedRole === 'SUPERVISOR') {
    return true;
  }
  if (normalizedRole === 'APPLICANT') {
    return false;
  }
  if (normalizedRole !== 'NURSE') {
    return false;
  }

  const application = await prisma.nurseApplication.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (!application) {
    return true;
  }

  return application.status === NurseApplicationStatus.RECRUITED;
}

export const requireClinicalAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    const allowed = await hasClinicalAccess(req.user.userId, req.user.role);
    if (!allowed) {
      const role = req.user.role.toUpperCase();
      if (role === 'APPLICANT') {
        throw new CustomError(
          'Patient access is available after you are certified and recruited. Complete your hiring steps first.',
          403
        );
      }
      throw new CustomError(
        'Patient access is granted after recruitment is confirmed by your supervisor.',
        403
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default requireClinicalAccess;
