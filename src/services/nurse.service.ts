import { Prisma, Nurse, NurseStatus, UserRole, PayFrequency } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { PasswordService } from '../utils/password';

export interface CreateNurseData {
  username: string;
  name: string;
  email?: string | null;
  password: string;
  phone: string;
  licenseNumber?: string | null;
  specialization: string;
  experience: number;
  certifications?: string[];
  hireDate: Date;
  dateOfBirth?: Date | null;
  avatar?: string;
  payFrequency?: 'WEEKLY' | 'MONTHLY' | null;
  workStartDate?: Date | null;
  payAmount?: number | null;
  /** Where the nurse actually stays/lives. */
  location?: string | null;
  nextOfKinName1?: string | null;
  nextOfKinPhone1?: string | null;
  nextOfKinName2?: string | null;
  nextOfKinPhone2?: string | null;
}

export type UpdateNurseData = Partial<CreateNurseData> & { status?: NurseStatus };

function parsePositiveInt(value: unknown, fieldLabel: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new CustomError(`${fieldLabel} must be a valid number`, 400);
  }
  return Math.round(parsed);
}

export class NurseService {
  static async createNurse(data: CreateNurseData): Promise<Nurse> {
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: emailVal, mode: 'insensitive' } },
      });
      if (existingUser) throw new CustomError('User with this email already exists', 409);
      const existingNurse = await prisma.nurse.findFirst({
        where: { email: { equals: emailVal, mode: 'insensitive' } },
      });
      if (existingNurse) {
        throw new CustomError('Nurse with this email already exists', 409);
      }
    }

    if (!data.password || data.password.length < 8) {
      throw new CustomError('Password must be at least 8 characters long', 400);
    }

    const hashedPassword = await PasswordService.hashPassword(data.password);

    const usernameNormalized = (data.username || '').trim().toLowerCase();
    if (!usernameNormalized) throw new CustomError('Username is required', 400);
    if (!data.payFrequency) throw new CustomError('Pay frequency is required', 400);

    const existingByUsername = await prisma.user.findFirst({
      where: { username: { equals: usernameNormalized, mode: 'insensitive' } },
    });
    if (existingByUsername) {
      throw new CustomError(
        `Username "${usernameNormalized}" is already taken. Please choose a different username.`,
        409
      );
    }

    const experience = parsePositiveInt(data.experience, 'Experience');
    let payAmount: number | null = null;
    if (data.payAmount !== undefined && data.payAmount !== null && String(data.payAmount).trim() !== '') {
      const parsedPay = parsePositiveInt(data.payAmount, 'Pay amount');
      payAmount = parsedPay > 0 ? parsedPay : null;
    }
    const licenseNumberValue: string | null = data.licenseNumber?.trim() || null;
    const hireDate = new Date(data.hireDate);
    if (Number.isNaN(hireDate.getTime())) {
      throw new CustomError('Hire date is invalid', 400);
    }
    const workStartDate = data.workStartDate ? new Date(data.workStartDate) : hireDate;
    if (Number.isNaN(workStartDate.getTime())) {
      throw new CustomError('Work start date is invalid', 400);
    }
    const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.dateOfBirth && dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
      throw new CustomError('Date of birth is invalid', 400);
    }

    try {
      const nurse = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: usernameNormalized,
            name: data.name,
            password: hashedPassword,
            role: UserRole.NURSE,
            phone: data.phone,
            department: 'Home Care',
            isActive: true,
            isVerified: true,
            email: emailVal,
            licenseNumber: licenseNumberValue,
            payFrequency: data.payFrequency as PayFrequency,
            workStartDate,
            payAmount,
            ...(dateOfBirth ? { dateOfBirth } : {}),
          },
        });

        const created = await tx.nurse.create({
          data: {
            name: data.name,
            phone: data.phone,
            ...(dateOfBirth ? { dateOfBirth } : {}),
            licenseNumber: licenseNumberValue,
            specialization: data.specialization,
            experience,
            certifications: data.certifications ?? [],
            hireDate,
            email: emailVal,
            avatar: data.avatar && data.avatar !== '' ? data.avatar : null,
            location: data.location?.trim() || null,
            nextOfKinName1: data.nextOfKinName1?.trim() || null,
            nextOfKinPhone1: data.nextOfKinPhone1?.trim() || null,
            nextOfKinName2: data.nextOfKinName2?.trim() || null,
            nextOfKinPhone2: data.nextOfKinPhone2?.trim() || null,
          },
        });

        logger.info('Nurse created with user account', { nurseId: created.id, userId: user.id });
        return created;
      });

      return nurse;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      if (error?.code === 'P2002') {
        const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(',') : String(error?.meta?.target ?? '');
        if (target.includes('username')) {
          throw new CustomError(
            `Username "${usernameNormalized}" is already taken. Please choose a different username.`,
            409
          );
        }
        if (target.includes('email')) {
          throw new CustomError('A user or nurse with this email already exists', 409);
        }
        throw new CustomError('A record with this value already exists', 409);
      }
      throw error;
    }
  }

  static async getNurseById(id: string): Promise<Nurse | null> {
    const nurse = await prisma.nurse.findUnique({
      where: { id },
      include: {
        appointments: true,
        schedules: true,
      }
    });
    if (!nurse) {
      return null;
    }
    const linkedUser = nurse.email
      ? await prisma.user.findFirst({
          where: { email: nurse.email, role: UserRole.NURSE },
          select: { username: true, payFrequency: true, workStartDate: true, payAmount: true },
        })
      : null;
    return {
      ...nurse,
      username: linkedUser?.username ?? null,
      payFrequency: linkedUser?.payFrequency ?? null,
      workStartDate: linkedUser?.workStartDate ?? null,
      payAmount: linkedUser?.payAmount ?? null,
    } as Nurse;
  }

  static async getNurses(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [nurses, total] = await Promise.all([
      prisma.nurse.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nurse.count()
    ]);

    const nurseEmails = nurses
      .map((nurse) => nurse.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));
    const linkedUsers = nurseEmails.length
      ? await prisma.user.findMany({
          where: { role: UserRole.NURSE, email: { in: nurseEmails } },
          select: { email: true, username: true, payFrequency: true, workStartDate: true, payAmount: true },
        })
      : [];
    const usersByEmail = new Map(
      linkedUsers.map((user) => [user.email?.trim().toLowerCase() ?? '', user])
    );
    const enrichedNurses = nurses.map((nurse) => {
      const lookupEmail = nurse.email?.trim().toLowerCase() ?? '';
      const linkedUser = usersByEmail.get(lookupEmail);
      return {
        ...nurse,
        username: linkedUser?.username ?? null,
        payFrequency: linkedUser?.payFrequency ?? null,
        workStartDate: linkedUser?.workStartDate ?? null,
        payAmount: linkedUser?.payAmount ?? null,
      };
    });

    return {
      nurses: enrichedNurses,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    };
  }

  static async updateNurse(id: string, data: UpdateNurseData): Promise<Nurse> {
    const existing = await prisma.nurse.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Nurse not found', 404);
    }

    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.nurse.findUnique({ where: { email: data.email } });
      if (emailExists) {
        throw new CustomError('Email already in use', 409);
      }
    }

    const updateData: Prisma.NurseUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) {
      const emailVal = data.email?.trim() || null;
      updateData.email = emailVal as string | null;
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.licenseNumber !== undefined) {
      const licenseNumberValue = data.licenseNumber?.trim() || null;
      updateData.licenseNumber = licenseNumberValue as string | null;
    }
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.experience !== undefined) {
      updateData.experience = parsePositiveInt(data.experience, 'Experience');
    }
    if (data.certifications !== undefined) updateData.certifications = data.certifications;
    if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate);
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.location !== undefined) updateData.location = data.location?.trim() || null;
    if (data.nextOfKinName1 !== undefined) updateData.nextOfKinName1 = data.nextOfKinName1?.trim() || null;
    if (data.nextOfKinPhone1 !== undefined) updateData.nextOfKinPhone1 = data.nextOfKinPhone1?.trim() || null;
    if (data.nextOfKinName2 !== undefined) updateData.nextOfKinName2 = data.nextOfKinName2?.trim() || null;
    if (data.nextOfKinPhone2 !== undefined) updateData.nextOfKinPhone2 = data.nextOfKinPhone2?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.payFrequency === null) {
      throw new CustomError('Pay frequency is required', 400);
    }

    const nurse = await prisma.nurse.update({ where: { id }, data: updateData });

    const lookupEmail = (nurse.email ?? existing.email)?.trim().toLowerCase();
    const linkedUser = lookupEmail
      ? await prisma.user.findFirst({
          where: { email: lookupEmail, role: UserRole.NURSE },
        })
      : null;

    if (linkedUser) {
      const userUpdate: Prisma.UserUncheckedUpdateInput = {};
      if (data.name !== undefined) userUpdate.name = data.name;
      if (data.email !== undefined) userUpdate.email = data.email?.trim() || null;
      if (data.phone !== undefined) userUpdate.phone = data.phone;
      if (data.licenseNumber !== undefined) {
        userUpdate.licenseNumber = data.licenseNumber?.trim() || null;
      }
      if (data.payFrequency !== undefined) userUpdate.payFrequency = data.payFrequency;
      if (data.payAmount !== undefined) {
        userUpdate.payAmount =
          data.payAmount != null && data.payAmount > 0 ? Math.round(data.payAmount) : null;
      }
      if (data.workStartDate !== undefined) {
        userUpdate.workStartDate = data.workStartDate ? new Date(data.workStartDate) : null;
      } else if (data.hireDate !== undefined) {
        userUpdate.workStartDate = new Date(data.hireDate);
      }
      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({ where: { id: linkedUser.id }, data: userUpdate });
      }
    }

    return nurse;
  }

  static async deleteNurse(id: string): Promise<void> {
    const existing = await prisma.nurse.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Nurse not found', 404);
    }

    await prisma.nurse.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });
  }
}

