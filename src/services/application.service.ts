import { NurseApplicationStatus, Prisma, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { PasswordService } from '../utils/password';
import { CustomError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import HiringEmailService from './hiringEmail.service';
import { FileUploadService } from './fileUpload.service';

export interface QualificationDocumentRecord {
  id: string;
  originalName: string;
  url: string;
  mimetype: string;
  size: number;
}

export interface PublicApplicationInput {
  name: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  experience?: number;
  message?: string;
  qualificationDriveLink?: string;
}

export interface PublicApplicationResult {
  username: string;
  temporaryPassword: string;
  applicationId: string;
  userId: string;
}

export interface BookInterviewInput {
  scheduledAt: string;
}

const applicationInclude = {
  user: {
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  },
  passedAttempt: {
    include: {
      exam: { select: { id: true, title: true } },
    },
  },
  reviewedBy: {
    select: { id: true, name: true },
  },
};

function generateCertificateNumber(): string {
  const randomSegment = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `CERT-${Date.now()}-${randomSegment}`;
}

function formatApplication(record: any) {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    licenseNumber: record.licenseNumber ?? undefined,
    experience: record.experience ?? undefined,
    message: record.message ?? undefined,
    qualificationDocuments: Array.isArray(record.qualificationDocuments)
      ? (record.qualificationDocuments as QualificationDocumentRecord[])
      : undefined,
    qualificationDriveLink: record.qualificationDriveLink ?? undefined,
    status: record.status,
    passedAttemptId: record.passedAttemptId ?? undefined,
    interviewScheduledAt: record.interviewScheduledAt?.toISOString(),
    interviewNotes: record.interviewNotes ?? undefined,
    reviewedById: record.reviewedById ?? undefined,
    reviewedAt: record.reviewedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    user: record.user,
    passedAttempt: record.passedAttempt
      ? {
          id: record.passedAttempt.id,
          score: record.passedAttempt.score,
          examTitle: record.passedAttempt.exam?.title,
        }
      : undefined,
    reviewedByName: record.reviewedBy?.name,
  };
}

function buildUsername(email: string): string {
  const base = email.split('@')[0]?.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'nurse';
  return base.slice(0, 40);
}

async function uniqueUsername(email: string): Promise<string> {
  let candidate = buildUsername(email);
  let suffix = 0;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${buildUsername(email)}${suffix}`;
  }
}

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let value = '';
  for (let i = 0; i < 12; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export class ApplicationService {
  static async submitPublicApplication(
    input: PublicApplicationInput,
    files: Express.Multer.File[] = []
  ): Promise<PublicApplicationResult> {
    const email = input.email.trim().toLowerCase();
    const driveLink = input.qualificationDriveLink?.trim() || null;

    if (files.length === 0 && !driveLink) {
      throw new CustomError(
        'Upload at least one qualification document or provide a Google Drive link.',
        400
      );
    }

    if (driveLink) {
      try {
        const parsed = new URL(driveLink);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('invalid protocol');
        }
      } catch {
        throw new CustomError('Qualification Google Drive link must be a valid URL.', 400);
      }
    }
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new CustomError('An account with this email already exists. Please log in instead.', 409);
    }

    const existingApplication = await prisma.nurseApplication.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingApplication) {
      throw new CustomError('An application with this email already exists.', 409);
    }

    const username = await uniqueUsername(email);
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await PasswordService.hashPassword(temporaryPassword);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email,
          name: input.name.trim(),
          phone: input.phone.trim(),
          licenseNumber: input.licenseNumber?.trim() || null,
          password: hashedPassword,
          role: UserRole.APPLICANT,
          department: 'Nursing',
          isActive: true,
          isVerified: true,
        },
      });

      const application = await tx.nurseApplication.create({
        data: {
          userId: user.id,
          name: input.name.trim(),
          email,
          phone: input.phone.trim(),
          licenseNumber: input.licenseNumber?.trim() || null,
          experience: input.experience ?? null,
          message: input.message?.trim() || null,
          qualificationDriveLink: driveLink,
          status: NurseApplicationStatus.EXAM_PENDING,
        },
      });

      return { user, application };
    });

    const qualificationDocuments: QualificationDocumentRecord[] = [];
    for (const file of files) {
      const uploaded = await FileUploadService.uploadQualificationDocument(
        file,
        result.application.id
      );
      qualificationDocuments.push({
        id: uploaded.fileId,
        originalName: uploaded.originalName,
        url: uploaded.url,
        mimetype: uploaded.mimetype,
        size: uploaded.size,
      });
    }

    if (qualificationDocuments.length > 0) {
      await prisma.nurseApplication.update({
        where: { id: result.application.id },
        data: {
          qualificationDocuments: qualificationDocuments as unknown as Prisma.InputJsonValue,
        },
      });
    }

    logger.info('Public nurse application submitted', {
      applicationId: result.application.id,
      userId: result.user.id,
      email,
    });

    void HiringEmailService.sendApplicationWelcome({
      name: input.name.trim(),
      email,
      username,
      temporaryPassword,
    });

    return {
      username,
      temporaryPassword,
      applicationId: result.application.id,
      userId: result.user.id,
    };
  }

  static async getMyApplication(userId: string) {
    const application = await prisma.nurseApplication.findUnique({
      where: { userId },
      include: applicationInclude,
    });
    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    return formatApplication(application);
  }

  static async bookInterview(userId: string, input: BookInterviewInput) {
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new CustomError('Invalid interview date', 400);
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new CustomError('Interview must be scheduled in the future', 400);
    }

    const application = await prisma.nurseApplication.findUnique({ where: { userId } });
    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    if (application.status !== NurseApplicationStatus.EXAM_PASSED) {
      throw new CustomError('You can only book an interview after passing the qualification exam', 400);
    }

    const updated = await prisma.nurseApplication.update({
      where: { id: application.id },
      data: {
        status: NurseApplicationStatus.INTERVIEW_SCHEDULED,
        interviewScheduledAt: scheduledAt,
      },
      include: applicationInclude,
    });

    void HiringEmailService.sendInterviewBooked({
      name: application.name,
      email: application.email,
      scheduledAt,
    });

    return formatApplication(updated);
  }

  static async listApplications(filters: {
    status?: NurseApplicationStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const where = filters.status ? { status: filters.status } : {};

    const [records, total] = await Promise.all([
      prisma.nurseApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ interviewScheduledAt: 'asc' }, { createdAt: 'desc' }],
        include: applicationInclude,
      }),
      prisma.nurseApplication.count({ where }),
    ]);

    return {
      applications: records.map(formatApplication),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async recordInterviewResult(
    applicationId: string,
    reviewerId: string,
    passed: boolean,
    notes?: string
  ) {
    const application = await prisma.nurseApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: true,
        passedAttempt: {
          include: { exam: true },
        },
      },
    });

    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    if (application.status !== NurseApplicationStatus.INTERVIEW_SCHEDULED) {
      throw new CustomError('Interview result can only be recorded for scheduled interviews', 400);
    }

    if (!passed) {
      const updated = await prisma.nurseApplication.update({
        where: { id: applicationId },
        data: {
          status: NurseApplicationStatus.INTERVIEW_FAILED,
          interviewNotes: notes?.trim() || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: applicationInclude,
      });
      void HiringEmailService.sendInterviewFailed({
        name: application.name,
        email: application.email,
      });
      return formatApplication(updated);
    }

    if (!application.passedAttemptId || !application.passedAttempt) {
      throw new CustomError('No passed exam attempt linked to this application', 400);
    }

    const attempt = application.passedAttempt;
    const score = attempt.score ?? 0;

    await prisma.$transaction(async (tx) => {
      await tx.trainingExamCertificate.upsert({
        where: { attemptId: attempt.id },
        create: {
          examId: attempt.examId,
          attemptId: attempt.id,
          userId: application.userId,
          score,
          certificateNumber: generateCertificateNumber(),
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: reviewerId,
          metadata: {
            candidateName: application.name,
            examTitle: attempt.exam.title,
            score,
            interviewPassedAt: new Date().toISOString(),
          },
        },
        update: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: reviewerId,
        },
      });

      await tx.user.update({
        where: { id: application.userId },
        data: { role: UserRole.NURSE },
      });

      await tx.nurse.upsert({
        where: { email: application.email },
        create: {
          name: application.name,
          email: application.email,
          phone: application.phone,
          licenseNumber: application.licenseNumber ?? 'PENDING',
          specialization: 'General Nursing',
          experience: application.experience ?? 0,
          status: 'ACTIVE',
          hireDate: new Date(),
        },
        update: {
          name: application.name,
          phone: application.phone,
          status: 'ACTIVE',
        },
      });

      await tx.nurseApplication.update({
        where: { id: applicationId },
        data: {
          status: NurseApplicationStatus.CERTIFIED,
          interviewNotes: notes?.trim() || null,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
    });

    const updated = await prisma.nurseApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });

    logger.info('Interview passed and candidate certified', { applicationId, userId: application.userId });

    void HiringEmailService.sendCertified({
      name: application.name,
      email: application.email,
    });

    return formatApplication(updated!);
  }

  static async markRecruited(applicationId: string, recruiterId: string) {
    const application = await prisma.nurseApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    if (application.status !== NurseApplicationStatus.CERTIFIED) {
      throw new CustomError('Only certified candidates can be marked as recruited', 400);
    }

    const updated = await prisma.nurseApplication.update({
      where: { id: applicationId },
      data: {
        status: NurseApplicationStatus.RECRUITED,
        reviewedById: recruiterId,
        reviewedAt: new Date(),
      },
      include: applicationInclude,
    });

    await prisma.user.update({
      where: { id: application.userId },
      data: {
        workStartDate: application.user.workStartDate ?? new Date(),
      },
    });

    logger.info('Candidate marked as recruited', { applicationId, userId: application.userId });

    void HiringEmailService.sendRecruited({
      name: application.name,
      email: application.email,
    });

    return formatApplication(updated);
  }

  static async handleExamAttemptResult(userId: string, attemptId: string, passed: boolean) {
    const application = await prisma.nurseApplication.findUnique({ where: { userId } });
    if (!application) return;

    if (passed) {
      if (
        application.status === NurseApplicationStatus.EXAM_PENDING ||
        application.status === NurseApplicationStatus.EXAM_FAILED
      ) {
        await prisma.nurseApplication.update({
          where: { id: application.id },
          data: {
            status: NurseApplicationStatus.EXAM_PASSED,
            passedAttemptId: attemptId,
          },
        });
        void HiringEmailService.sendExamPassed({
          name: application.name,
          email: application.email,
        });
      }
      return;
    }

    if (
      application.status === NurseApplicationStatus.EXAM_PENDING ||
      application.status === NurseApplicationStatus.EXAM_FAILED
    ) {
      await prisma.nurseApplication.update({
        where: { id: application.id },
        data: { status: NurseApplicationStatus.EXAM_FAILED },
      });
      void HiringEmailService.sendExamFailed({
        name: application.name,
        email: application.email,
      });
    }
  }
}

export default ApplicationService;
