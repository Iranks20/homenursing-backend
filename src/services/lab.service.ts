import {
  Prisma,
  SampleType,
  Priority,
  SampleStatus,
  ResultStatus,
  LabSample,
  LabResult,
  Referral,
  ReferrerRole,
  ReferralRole,
  ReferralType,
  ReferralStatus,
  Urgency,
} from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

const labSampleInclude = {
  patient: true,
  results: true,
} as const;

const labResultInclude = {
  sample: true,
} as const;

const referralInclude = {
  patient: true,
} as const;

type LabSampleWithRelations = Prisma.LabSampleGetPayload<{ include: typeof labSampleInclude }>;
type LabResultWithRelations = Prisma.LabResultGetPayload<{ include: typeof labResultInclude }>;
type ReferralWithRelations = Prisma.ReferralGetPayload<{ include: typeof referralInclude }>;

const DEFAULT_PRIORITY = Priority.ROUTINE;
const DEFAULT_SAMPLE_STATUS = SampleStatus.PENDING;
const DEFAULT_RESULT_STATUS = ResultStatus.NORMAL;
const DEFAULT_REFERRAL_STATUS = ReferralStatus.PENDING;
const DEFAULT_URGENCY = Urgency.ROUTINE;

type Nullable<T> = T | undefined;

export interface CollectLabSampleData {
  patientId: string;
  sampleType: SampleType;
  testName: string;
  testCode: string;
  collectionDate: Date;
  collectionTime: string;
  collectedBy: string;
  collectionLocation: string;
  priority?: Priority;
  instructions: string;
  fastingRequired?: boolean;
  fastingHours?: number;
  specialInstructions?: string;
  labId?: string;
  labName?: string;
  notes?: string;
}

export interface UpdateLabSampleData {
  status?: SampleStatus;
  trackingNumber?: string;
  labId?: string;
  labName?: string;
  notes?: string;
}

export interface AddLabResultData {
  sampleId: string;
  testName: string;
  testCode: string;
  result: string;
  value: number;
  unit?: string;
  referenceRange: string;
  status?: ResultStatus;
  flagged?: boolean;
  comments?: string;
  reportedBy: string;
  verifiedBy?: string;
}

export interface SendReferralData {
  patientId: string;
  referredBy: string;
  referredByName: string;
  referredByRole: ReferrerRole;
  referredTo: string;
  referredToName: string;
  referredToRole: ReferralRole;
  referralType: ReferralType;
  specialty?: string;
  reason: string;
  urgency?: Urgency;
  appointmentDate?: Date;
  appointmentTime?: string;
  location?: string;
  contactInfo?: string;
  notes?: string;
  attachments?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date;
  insuranceProvider?: string;
  policyNumber?: string;
  authorizationRequired?: boolean;
  authorizationNumber?: string;
  status?: ReferralStatus;
}

export type UpdateReferralData = Partial<SendReferralData>;

export class LabService {
  static async collectSample(data: CollectLabSampleData): Promise<LabSampleWithRelations> {
    const sampleData: Prisma.LabSampleUncheckedCreateInput = {
      patientId: data.patientId,
      sampleType: data.sampleType,
      testName: data.testName,
      testCode: data.testCode,
      collectionDate: data.collectionDate,
      collectionTime: data.collectionTime,
      collectedBy: data.collectedBy,
      collectionLocation: data.collectionLocation,
      priority: data.priority ?? DEFAULT_PRIORITY,
      instructions: data.instructions,
      fastingRequired: data.fastingRequired ?? false,
      status: DEFAULT_SAMPLE_STATUS,
    };

    if (data.fastingHours !== undefined) sampleData.fastingHours = data.fastingHours;
    if (data.specialInstructions !== undefined) sampleData.specialInstructions = data.specialInstructions;
    if (data.labId !== undefined) sampleData.labId = data.labId;
    if (data.labName !== undefined) sampleData.labName = data.labName;
    if (data.notes !== undefined) sampleData.notes = data.notes;

    const sample = await prisma.labSample.create({
      data: sampleData,
      include: labSampleInclude,
    });

    logger.info('Lab sample collected', { sampleId: sample.id });
    return sample;
  }

  static async getLabSamples(patientId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.LabSampleWhereInput = {};

    if (patientId) {
      where.patientId = patientId;
    }

    const [samples, total] = await Promise.all([
      prisma.labSample.findMany({
        where,
        skip,
        take: limit,
        orderBy: { collectionDate: 'desc' },
        include: labSampleInclude,
      }),
      prisma.labSample.count({ where }),
    ]);

    return {
      samples,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getLabSampleById(id: string): Promise<LabSampleWithRelations | null> {
    return prisma.labSample.findUnique({
      where: { id },
      include: labSampleInclude,
    });
  }

  static async updateLabSample(id: string, data: UpdateLabSampleData): Promise<LabSample> {
    const existing = await prisma.labSample.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Lab sample not found', 404);
    }

    const updates: Prisma.LabSampleUncheckedUpdateInput = {};

    if (data.status !== undefined) updates.status = data.status;
    if (data.trackingNumber !== undefined) updates.trackingNumber = data.trackingNumber;
    if (data.labId !== undefined) updates.labId = data.labId;
    if (data.labName !== undefined) updates.labName = data.labName;
    if (data.notes !== undefined) updates.notes = data.notes;

    return prisma.labSample.update({
      where: { id },
      data: updates,
    });
  }

  static async addLabResult(data: AddLabResultData): Promise<LabResultWithRelations> {
    const resultData: Prisma.LabResultUncheckedCreateInput = {
      sampleId: data.sampleId,
      testName: data.testName,
      testCode: data.testCode,
      result: data.result,
      value: data.value,
      referenceRange: data.referenceRange,
      status: data.status ?? DEFAULT_RESULT_STATUS,
      flagged: data.flagged ?? false,
      reportedBy: data.reportedBy,
      reportedDate: new Date(),
    };

    if (data.unit !== undefined) resultData.unit = data.unit;
    if (data.comments !== undefined) resultData.comments = data.comments;
    if (data.verifiedBy !== undefined) {
      resultData.verifiedBy = data.verifiedBy;
      resultData.verifiedDate = new Date();
    }

    const result = await prisma.labResult.create({
      data: resultData,
      include: labResultInclude,
    });

    logger.info('Lab result added', { resultId: result.id });
    return result;
  }

  static async getLabResults(sampleId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.LabResultWhereInput = {};

    if (sampleId) {
      where.sampleId = sampleId;
    }

    const [results, total] = await Promise.all([
      prisma.labResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { reportedDate: 'desc' },
        include: labResultInclude,
      }),
      prisma.labResult.count({ where }),
    ]);

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getLabResultById(id: string): Promise<LabResultWithRelations | null> {
    return prisma.labResult.findUnique({
      where: { id },
      include: labResultInclude,
    });
  }
}

export class ReferralService {
  static async sendReferral(data: SendReferralData): Promise<ReferralWithRelations> {
    const referralData: Prisma.ReferralUncheckedCreateInput = {
      patientId: data.patientId,
      referredBy: data.referredBy,
      referredByName: data.referredByName,
      referredByRole: data.referredByRole,
      referredTo: data.referredTo,
      referredToName: data.referredToName,
      referredToRole: data.referredToRole,
      referralType: data.referralType,
      reason: data.reason,
      urgency: data.urgency ?? DEFAULT_URGENCY,
      referralDate: new Date(),
      status: data.status ?? DEFAULT_REFERRAL_STATUS,
      attachments: data.attachments ?? [],
      followUpRequired: data.followUpRequired ?? false,
      authorizationRequired: data.authorizationRequired ?? false,
    };

    if (data.specialty !== undefined) referralData.specialty = data.specialty;
    if (data.appointmentDate !== undefined) referralData.appointmentDate = data.appointmentDate;
    if (data.appointmentTime !== undefined) referralData.appointmentTime = data.appointmentTime;
    if (data.location !== undefined) referralData.location = data.location;
    if (data.contactInfo !== undefined) referralData.contactInfo = data.contactInfo;
    if (data.notes !== undefined) referralData.notes = data.notes;
    if (data.followUpDate !== undefined) referralData.followUpDate = data.followUpDate;
    if (data.insuranceProvider !== undefined) referralData.insuranceProvider = data.insuranceProvider;
    if (data.policyNumber !== undefined) referralData.policyNumber = data.policyNumber;
    if (data.authorizationNumber !== undefined) referralData.authorizationNumber = data.authorizationNumber;

    const referral = await prisma.referral.create({
      data: referralData,
      include: referralInclude,
    });

    logger.info('Referral sent', { referralId: referral.id });
    return referral;
  }

  static async getReferrals(patientId?: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReferralWhereInput = {};

    if (patientId) {
      where.patientId = patientId;
    }

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        skip,
        take: limit,
        orderBy: { referralDate: 'desc' },
        include: referralInclude,
      }),
      prisma.referral.count({ where }),
    ]);

    return {
      referrals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getReferralById(id: string): Promise<ReferralWithRelations | null> {
    return prisma.referral.findUnique({
      where: { id },
      include: referralInclude,
    });
  }

  static async updateReferral(id: string, data: UpdateReferralData): Promise<Referral> {
    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Referral not found', 404);
    }

    const updates: Prisma.ReferralUncheckedUpdateInput = {};

    const setIfDefined = <K extends keyof Prisma.ReferralUncheckedUpdateInput>(key: K, value: Nullable<Prisma.ReferralUncheckedUpdateInput[K]>) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    };

    setIfDefined('patientId', data.patientId);
    setIfDefined('referredBy', data.referredBy);
    setIfDefined('referredByName', data.referredByName);
    setIfDefined('referredTo', data.referredTo);
    setIfDefined('referredToName', data.referredToName);
    setIfDefined('specialty', data.specialty);
    setIfDefined('reason', data.reason);
    setIfDefined('appointmentTime', data.appointmentTime);
    setIfDefined('location', data.location);
    setIfDefined('contactInfo', data.contactInfo);
    setIfDefined('notes', data.notes);
    setIfDefined('attachments', data.attachments);
    setIfDefined('followUpRequired', data.followUpRequired);
    setIfDefined('followUpDate', data.followUpDate);
    setIfDefined('insuranceProvider', data.insuranceProvider);
    setIfDefined('policyNumber', data.policyNumber);
    setIfDefined('authorizationRequired', data.authorizationRequired);
    setIfDefined('authorizationNumber', data.authorizationNumber);

    if (data.referredByRole !== undefined) updates.referredByRole = data.referredByRole;
    if (data.referredToRole !== undefined) updates.referredToRole = data.referredToRole;
    if (data.referralType !== undefined) updates.referralType = data.referralType;
    if (data.urgency !== undefined) updates.urgency = data.urgency;
    if (data.appointmentDate !== undefined) updates.appointmentDate = data.appointmentDate;
    if (data.status !== undefined) updates.status = data.status;

    return prisma.referral.update({
      where: { id },
      data: updates,
    });
  }

  static async acceptReferral(id: string): Promise<Referral> {
    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Referral not found', 404);
    }

    return prisma.referral.update({
      where: { id },
      data: { status: ReferralStatus.ACCEPTED },
    });
  }

  static async declineReferral(id: string): Promise<Referral> {
    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Referral not found', 404);
    }

    return prisma.referral.update({
      where: { id },
      data: { status: ReferralStatus.DECLINED },
    });
  }

  static async getPatientReferrals(patientId: string) {
    return prisma.referral.findMany({
      where: { patientId },
      orderBy: { referralDate: 'desc' },
      include: referralInclude,
    });
  }
}

