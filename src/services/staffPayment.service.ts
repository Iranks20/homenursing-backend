import { PayFrequency, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { buildStaffPaymentSchedule, getNextPaymentDate } from '../utils/staffPaymentSchedule';

const PAYABLE_ROLES: UserRole[] = [UserRole.NURSE, UserRole.SUPERVISOR];

export interface StaffPaymentScheduleItem {
  userId: string;
  name: string;
  email?: string;
  role: UserRole;
  payFrequency?: PayFrequency;
  workStartDate?: string;
  nextPaymentDate?: string;
  paymentSchedule: ReturnType<typeof buildStaffPaymentSchedule>;
}

export class StaffPaymentService {
  static async listSchedules(filters?: { role?: UserRole; payFrequency?: PayFrequency }) {
    const where: {
      isActive: boolean;
      role: UserRole | { in: UserRole[] };
      payFrequency?: PayFrequency;
    } = {
      isActive: true,
      role: filters?.role && PAYABLE_ROLES.includes(filters.role)
        ? filters.role
        : { in: PAYABLE_ROLES },
    };
    if (filters?.payFrequency) {
      where.payFrequency = filters.payFrequency;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        payFrequency: true,
        workStartDate: true,
      },
    });

    return users.map((user) => {
      const workStartDate = user.workStartDate ?? undefined;
      const payFrequency = user.payFrequency ?? undefined;
      let paymentSchedule: StaffPaymentScheduleItem['paymentSchedule'] = [];
      let nextPaymentDate: string | undefined;

      if (workStartDate && payFrequency) {
        paymentSchedule = buildStaffPaymentSchedule(workStartDate, payFrequency);
        const next = getNextPaymentDate(workStartDate, payFrequency);
        nextPaymentDate = next?.toISOString();
      }

      return {
        userId: user.id,
        name: user.name,
        email: user.email ?? undefined,
        role: user.role,
        payFrequency,
        workStartDate: workStartDate?.toISOString(),
        nextPaymentDate,
        paymentSchedule,
      };
    });
  }
}

export default StaffPaymentService;
