import { CertificatePaymentStatus, NurseApplicationStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { ENV_CONFIG } from '../config/environment';
import { CustomError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import HiringEmailService from './hiringEmail.service';
import PesapalService from './pesapal.service';
import CertificatePdfService from './certificatePdf.service';

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

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Nurse', lastName: 'Applicant' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: 'Applicant' };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export class CertificatePaymentService {
  static async initiateForUser(userId: string) {
    if (!ENV_CONFIG.PESAPAL_CONSUMER_KEY || !ENV_CONFIG.PESAPAL_CONSUMER_SECRET) {
      throw new CustomError('Certificate payments are not configured yet', 503);
    }

    const application = await prisma.nurseApplication.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    if (application.status !== NurseApplicationStatus.INTERVIEW_PASSED) {
      throw new CustomError('Certificate payment is only available after passing the physical interview', 400);
    }

    const completed = await prisma.nurseCertificatePayment.findFirst({
      where: { applicationId: application.id, status: CertificatePaymentStatus.COMPLETED },
    });
    if (completed) {
      throw new CustomError('Certificate payment has already been completed', 400);
    }

    const pending = await prisma.nurseCertificatePayment.findFirst({
      where: {
        applicationId: application.id,
        status: CertificatePaymentStatus.PENDING,
        redirectUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending?.redirectUrl) {
      return {
        paymentId: pending.id,
        redirectUrl: pending.redirectUrl,
        amount: pending.amount,
        currency: pending.currency,
        merchantReference: pending.merchantReference,
      };
    }

    const merchantReference = `CERT-${application.id}-${randomUUID()}`;
    const amount = ENV_CONFIG.CERTIFICATE_FEE_AMOUNT;
    const currency = ENV_CONFIG.CERTIFICATE_FEE_CURRENCY;
    const notificationId = await PesapalService.resolveNotificationId();
    const { firstName, lastName } = splitName(application.name);

    const payment = await prisma.nurseCertificatePayment.create({
      data: {
        applicationId: application.id,
        userId: application.userId,
        amount,
        currency,
        merchantReference,
        status: CertificatePaymentStatus.PENDING,
      },
    });

    try {
      const order = await PesapalService.submitOrder({
        merchantReference,
        amount,
        currency,
        description: ENV_CONFIG.CERTIFICATE_FEE_DESCRIPTION,
        callbackUrl: ENV_CONFIG.PESAPAL_CALLBACK_URL,
        notificationId,
        email: application.email,
        phone: application.phone,
        firstName,
        lastName,
      });

      const updated = await prisma.nurseCertificatePayment.update({
        where: { id: payment.id },
        data: {
          orderTrackingId: order.orderTrackingId,
          redirectUrl: order.redirectUrl,
        },
      });

      return {
        paymentId: updated.id,
        redirectUrl: updated.redirectUrl!,
        amount: updated.amount,
        currency: updated.currency,
        merchantReference: updated.merchantReference,
      };
    } catch (error) {
      await prisma.nurseCertificatePayment.update({
        where: { id: payment.id },
        data: { status: CertificatePaymentStatus.FAILED },
      });
      throw error;
    }
  }

  static async processCallback(query: {
    orderTrackingId?: string;
    orderMerchantReference?: string;
  }) {
    const merchantReference = query.orderMerchantReference;
    const orderTrackingId = query.orderTrackingId;
    if (!merchantReference && !orderTrackingId) {
      throw new CustomError('Missing Pesapal callback parameters', 400);
    }

    const payment = await prisma.nurseCertificatePayment.findFirst({
      where: merchantReference
        ? { merchantReference }
        : { orderTrackingId: orderTrackingId! },
    });

    if (!payment) {
      throw new CustomError('Payment record not found', 404);
    }

    const trackingId = orderTrackingId ?? payment.orderTrackingId;
    if (!trackingId) {
      return { payment, completed: false };
    }

    const status = await PesapalService.getTransactionStatus(trackingId);
    const completed = PesapalService.isPaymentCompleted(status);
    if (completed) {
      const finalizeInput: { orderTrackingId?: string; paymentMethod?: string } = {
        orderTrackingId: trackingId,
      };
      if (status.payment_method) {
        finalizeInput.paymentMethod = status.payment_method;
      }
      await this.finalizeSuccessfulPayment(payment.id, finalizeInput);
    }

    return { payment, completed };
  }

  static async finalizeSuccessfulPayment(
    paymentId: string,
    input?: { orderTrackingId?: string; paymentMethod?: string }
  ) {
    const payment = await prisma.nurseCertificatePayment.findUnique({
      where: { id: paymentId },
      include: {
        application: {
          include: {
            user: true,
            passedAttempt: { include: { exam: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new CustomError('Payment record not found', 404);
    }
    if (payment.status === CertificatePaymentStatus.COMPLETED) {
      return payment;
    }

    await prisma.nurseCertificatePayment.update({
      where: { id: payment.id },
      data: {
        status: CertificatePaymentStatus.COMPLETED,
        paidAt: new Date(),
        orderTrackingId: input?.orderTrackingId ?? payment.orderTrackingId,
        paymentMethod: input?.paymentMethod ?? payment.paymentMethod,
      },
    });

    await this.finalizeCertification(payment.applicationId, payment.application.reviewedById ?? undefined);
    return payment;
  }

  static async finalizeCertification(applicationId: string, reviewerId?: string) {
    const application = await prisma.nurseApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: true,
        passedAttempt: { include: { exam: true } },
      },
    });

    if (!application) {
      throw new CustomError('Application not found', 404);
    }
    if (application.status === NurseApplicationStatus.CERTIFIED || application.status === NurseApplicationStatus.RECRUITED) {
      return;
    }
    if (application.status !== NurseApplicationStatus.INTERVIEW_PASSED) {
      throw new CustomError('Application is not ready for certification', 400);
    }
    if (!application.passedAttemptId || !application.passedAttempt) {
      throw new CustomError('No passed exam attempt linked to this application', 400);
    }

    const attempt = application.passedAttempt;
    const score = attempt.score ?? 0;
    const certificateNumber = generateCertificateNumber();

    const certificate = await prisma.$transaction(async (tx) => {
      const cert = await tx.trainingExamCertificate.upsert({
        where: { attemptId: attempt.id },
        create: {
          examId: attempt.examId,
          attemptId: attempt.id,
          userId: application.userId,
          score,
          certificateNumber,
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: reviewerId ?? null,
          metadata: {
            candidateName: application.name,
            examTitle: attempt.exam.title,
            score,
            interviewPassedAt: application.reviewedAt?.toISOString(),
            certifiedAt: new Date().toISOString(),
          },
        },
        update: {
          status: 'APPROVED',
          approvedAt: new Date(),
          ...(reviewerId ? { approvedById: reviewerId } : {}),
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
        data: { status: NurseApplicationStatus.CERTIFIED },
      });

      return cert;
    });

    const pdfPath = await CertificatePdfService.generate(
      {
        candidateName: application.name,
        certificateNumber: certificate.certificateNumber,
        examTitle: attempt.exam.title,
        score,
        issuedAt: certificate.issuedAt,
      },
      certificate.id
    );

    const existingMetadata =
      certificate.metadata && typeof certificate.metadata === 'object' && !Array.isArray(certificate.metadata)
        ? (certificate.metadata as Record<string, unknown>)
        : {};

    await prisma.trainingExamCertificate.update({
      where: { id: certificate.id },
      data: {
        metadata: {
          ...existingMetadata,
          pdfPath,
        } as Prisma.InputJsonValue,
      },
    });

    logger.info('Candidate certified after certificate payment', {
      applicationId,
      userId: application.userId,
      certificateId: certificate.id,
    });

    void HiringEmailService.sendCertified({
      name: application.name,
      email: application.email,
    });
  }

  static async getLatestForUser(userId: string) {
    return prisma.nurseCertificatePayment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default CertificatePaymentService;
