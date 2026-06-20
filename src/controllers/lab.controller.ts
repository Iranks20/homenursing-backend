import { Request, Response, NextFunction } from 'express';
import {
  SampleType,
  Priority,
  SampleStatus,
  ResultStatus,
  ReferrerRole,
  ReferralRole,
  ReferralType,
  Urgency,
  ReferralStatus,
} from '@prisma/client';
import { LabService, ReferralService, CollectLabSampleData, UpdateLabSampleData, AddLabResultData, SendReferralData, UpdateReferralData } from '../services/lab.service';
import { 
  validateBody,
  collectLabSampleSchema,
  updateLabSampleSchema,
  addLabResultSchema,
  sendReferralSchema,
} from '../validators/lab.validator';
import { CustomError } from '../middleware/error.middleware';

const parseNumber = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(value as string, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const requireParamId = (id: string | undefined, resource: string): string => {
  if (!id) {
    throw new CustomError(`${resource} ID is required`, 400);
  }
  return id;
};

const requireAuthUser = (req: Request): { userId: string; email?: string; role?: string } => {
  const user = (req as Request & { user?: { id?: string; userId?: string; email?: string; role?: string } }).user;
  const userId = user?.id ?? user?.userId;
  if (!userId) {
    throw new CustomError('Authentication required', 401);
  }
  const result: { userId: string; email?: string; role?: string } = { userId };
  if (user?.email) result.email = user.email;
  if (user?.role) result.role = user.role;
  return result;
};

const toSampleType = (value: string): SampleType => {
  const enumValue = SampleType[value as keyof typeof SampleType];
  if (!enumValue) {
    throw new CustomError('Invalid sample type', 400);
  }
  return enumValue;
};

const toPriority = (value?: string): Priority | undefined => {
  if (value === undefined) return undefined;
  const enumValue = Priority[value as keyof typeof Priority];
  if (!enumValue) {
    throw new CustomError('Invalid priority', 400);
  }
  return enumValue;
};

const toSampleStatus = (value?: string): SampleStatus | undefined => {
  if (value === undefined) return undefined;
  const enumValue = SampleStatus[value as keyof typeof SampleStatus];
  if (!enumValue) {
    throw new CustomError('Invalid sample status', 400);
  }
  return enumValue;
};

const toResultStatus = (value?: string): ResultStatus | undefined => {
  if (value === undefined) return undefined;
  const enumValue = ResultStatus[value as keyof typeof ResultStatus];
  if (!enumValue) {
    throw new CustomError('Invalid lab result status', 400);
  }
  return enumValue;
};

const toReferrerRole = (value: string): ReferrerRole => {
  const enumValue = ReferrerRole[value as keyof typeof ReferrerRole];
  if (!enumValue) {
    throw new CustomError('Invalid referrer role', 400);
  }
  return enumValue;
};

const toReferralRole = (value: string): ReferralRole => {
  const enumValue = ReferralRole[value as keyof typeof ReferralRole];
  if (!enumValue) {
    throw new CustomError('Invalid referral role', 400);
  }
  return enumValue;
};

const toReferralType = (value: string): ReferralType => {
  const enumValue = ReferralType[value as keyof typeof ReferralType];
  if (!enumValue) {
    throw new CustomError('Invalid referral type', 400);
  }
  return enumValue;
};

const toUrgency = (value?: string): Urgency | undefined => {
  if (value === undefined) return undefined;
  const enumValue = Urgency[value as keyof typeof Urgency];
  if (!enumValue) {
    throw new CustomError('Invalid urgency', 400);
  }
  return enumValue;
};

const toReferralStatus = (value?: string): ReferralStatus | undefined => {
  if (value === undefined) return undefined;
  const enumValue = ReferralStatus[value as keyof typeof ReferralStatus];
  if (!enumValue) {
    throw new CustomError('Invalid referral status', 400);
  }
  return enumValue;
};

type CollectLabSampleInput = {
  patientId: string;
  sampleType: string;
  testName: string;
  testCode: string;
  collectionDate: Date | string;
  collectionTime: string;
  collectedBy: string;
  collectionLocation: string;
  priority?: string;
  instructions: string;
  fastingRequired?: boolean;
  fastingHours?: number;
  specialInstructions?: string;
  labId?: string;
  labName?: string;
  notes?: string;
};

type UpdateLabSampleInput = {
  status?: string;
  trackingNumber?: string;
  labId?: string;
  labName?: string;
  notes?: string;
};

type AddLabResultInput = {
  sampleId: string;
  testName: string;
  testCode: string;
  result: string;
  value: number;
  unit?: string;
  referenceRange: string;
  status?: string;
  flagged?: boolean;
  comments?: string;
  reportedBy: string;
  verifiedBy?: string;
};

type SendReferralInput = {
  patientId: string;
  referredBy: string;
  referredByName: string;
  referredByRole: string;
  referredTo: string;
  referredToName: string;
  referredToRole: string;
  referralType: string;
  specialty?: string;
  reason: string;
  urgency?: string;
  appointmentDate?: Date | string;
  appointmentTime?: string;
  location?: string;
  contactInfo?: string;
  notes?: string;
  attachments?: string[];
  followUpRequired?: boolean;
  followUpDate?: Date | string;
  insuranceProvider?: string;
  policyNumber?: string;
  authorizationRequired?: boolean;
  authorizationNumber?: string;
  status?: string;
};

const parseDate = (value: unknown, name: string): Date | undefined => {
  if (value === undefined) return undefined;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`${name} is invalid`, 400);
  }
  return date;
};

export class LabController {
  static async getLabSamples(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await LabService.getLabSamples(patientId, page, limit);
      res.status(200).json({ success: true, data: result.samples, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getLabSampleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sampleId = requireParamId(req.params.id, 'Lab sample');
      const sample = await LabService.getLabSampleById(sampleId);
      if (!sample) throw new CustomError('Lab sample not found', 404);
      res.status(200).json({ success: true, data: sample });
    } catch (error) {
      next(error);
    }
  }

  static async collectSample(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<CollectLabSampleInput>(collectLabSampleSchema, req.body);
      const payload: CollectLabSampleData = {
        patientId: data.patientId,
        sampleType: toSampleType(data.sampleType),
        testName: data.testName,
        testCode: data.testCode,
        collectionDate: parseDate(data.collectionDate, 'collectionDate')!,
        collectionTime: data.collectionTime,
        collectedBy: data.collectedBy,
        collectionLocation: data.collectionLocation,
        instructions: data.instructions,
      };

      const priority = toPriority(data.priority);
      if (priority) payload.priority = priority;
      if (data.fastingRequired !== undefined) payload.fastingRequired = data.fastingRequired;
      if (data.fastingHours !== undefined) payload.fastingHours = data.fastingHours;
      if (data.specialInstructions !== undefined) payload.specialInstructions = data.specialInstructions;
      if (data.labId !== undefined) payload.labId = data.labId;
      if (data.labName !== undefined) payload.labName = data.labName;
      if (data.notes !== undefined) payload.notes = data.notes;

      const sample = await LabService.collectSample(payload);
      res.status(201).json({ success: true, message: 'Lab sample collected successfully', data: sample });
    } catch (error) {
      next(error);
    }
  }

  static async updateLabSample(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Lab sample');
      const data = validateBody<UpdateLabSampleInput>(updateLabSampleSchema, req.body);
      const updates: UpdateLabSampleData = {};

      const status = toSampleStatus(data.status);
      if (status) updates.status = status;
      if (data.trackingNumber !== undefined) updates.trackingNumber = data.trackingNumber;
      if (data.labId !== undefined) updates.labId = data.labId;
      if (data.labName !== undefined) updates.labName = data.labName;
      if (data.notes !== undefined) updates.notes = data.notes;

      const sample = await LabService.updateLabSample(id, updates);
      res.status(200).json({ success: true, message: 'Lab sample updated successfully', data: sample });
    } catch (error) {
      next(error);
    }
  }

  static async getLabResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sampleId = req.query.sampleId as string | undefined;
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await LabService.getLabResults(sampleId, page, limit);
      res.status(200).json({ success: true, data: result.results, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getLabResultById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const resultId = requireParamId(req.params.id, 'Lab result');
      const result = await LabService.getLabResultById(resultId);
      if (!result) throw new CustomError('Lab result not found', 404);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async addLabResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = validateBody<AddLabResultInput>(addLabResultSchema, req.body);
      const payload: AddLabResultData = {
        sampleId: data.sampleId,
        testName: data.testName,
        testCode: data.testCode,
        result: data.result,
        value: data.value,
        referenceRange: data.referenceRange,
        reportedBy: data.reportedBy,
      };

      if (data.unit !== undefined) payload.unit = data.unit;
      const status = toResultStatus(data.status);
      if (status) payload.status = status;
      if (data.flagged !== undefined) payload.flagged = data.flagged;
      if (data.comments !== undefined) payload.comments = data.comments;
      if (data.verifiedBy !== undefined) payload.verifiedBy = data.verifiedBy;

      const result = await LabService.addLabResult(payload);
      res.status(201).json({ success: true, message: 'Lab result added successfully', data: result });
    } catch (error) {
      next(error);
    }
  }
}

export class ReferralController {
  static async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.query.patientId as string | undefined;
      const page = parseNumber(req.query.page, 1);
      const limit = parseNumber(req.query.limit, 10);
      const result = await ReferralService.getReferrals(patientId, page, limit);
      res.status(200).json({ success: true, data: result.referrals, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  static async getReferralById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const referralId = requireParamId(req.params.id, 'Referral');
      const referral = await ReferralService.getReferralById(referralId);
      if (!referral) throw new CustomError('Referral not found', 404);
      res.status(200).json({ success: true, data: referral });
    } catch (error) {
      next(error);
    }
  }

  static async sendReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = requireAuthUser(req);

      const data = validateBody<SendReferralInput>(sendReferralSchema, req.body);
      const payload: SendReferralData = {
        patientId: data.patientId,
        referredBy: user.userId,
        referredByName: user.email ?? data.referredByName,
        referredByRole: toReferrerRole(data.referredByRole),
        referredTo: data.referredTo,
        referredToName: data.referredToName,
        referredToRole: toReferralRole(data.referredToRole),
        referralType: toReferralType(data.referralType),
        reason: data.reason,
      };

      if (data.specialty !== undefined) payload.specialty = data.specialty;
      const urgency = toUrgency(data.urgency);
      if (urgency) payload.urgency = urgency;
      const appointmentDate = parseDate(data.appointmentDate, 'appointmentDate');
      if (appointmentDate) payload.appointmentDate = appointmentDate;
      if (data.appointmentTime !== undefined) payload.appointmentTime = data.appointmentTime;
      if (data.location !== undefined) payload.location = data.location;
      if (data.contactInfo !== undefined) payload.contactInfo = data.contactInfo;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.attachments !== undefined) payload.attachments = data.attachments;
      if (data.followUpRequired !== undefined) payload.followUpRequired = data.followUpRequired;
      const followUpDate = parseDate(data.followUpDate, 'followUpDate');
      if (followUpDate) payload.followUpDate = followUpDate;
      if (data.insuranceProvider !== undefined) payload.insuranceProvider = data.insuranceProvider;
      if (data.policyNumber !== undefined) payload.policyNumber = data.policyNumber;
      if (data.authorizationRequired !== undefined) payload.authorizationRequired = data.authorizationRequired;
      if (data.authorizationNumber !== undefined) payload.authorizationNumber = data.authorizationNumber;
      const status = toReferralStatus(data.status);
      if (status !== undefined) payload.status = status;

      const referral = await ReferralService.sendReferral(payload);
      res.status(201).json({ success: true, message: 'Referral sent successfully', data: referral });
    } catch (error) {
      next(error);
    }
  }

  static async updateReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = requireParamId(req.params.id, 'Referral');
      const data = req.body as Partial<SendReferralInput & { status?: string }>;
      const updates: UpdateReferralData = {};

      if (data.patientId !== undefined) updates.patientId = data.patientId;
      if (data.referredBy !== undefined) updates.referredBy = data.referredBy;
      if (data.referredByName !== undefined) updates.referredByName = data.referredByName;
      if (data.referredTo !== undefined) updates.referredTo = data.referredTo;
      if (data.referredToName !== undefined) updates.referredToName = data.referredToName;
      if (data.specialty !== undefined) updates.specialty = data.specialty;
      if (data.reason !== undefined) updates.reason = data.reason;
      if (data.appointmentTime !== undefined) updates.appointmentTime = data.appointmentTime;
      if (data.location !== undefined) updates.location = data.location;
      if (data.contactInfo !== undefined) updates.contactInfo = data.contactInfo;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.attachments !== undefined) updates.attachments = data.attachments;
      if (data.followUpRequired !== undefined) updates.followUpRequired = data.followUpRequired;
      if (data.insuranceProvider !== undefined) updates.insuranceProvider = data.insuranceProvider;
      if (data.policyNumber !== undefined) updates.policyNumber = data.policyNumber;
      if (data.authorizationRequired !== undefined) updates.authorizationRequired = data.authorizationRequired;
      if (data.authorizationNumber !== undefined) updates.authorizationNumber = data.authorizationNumber;

      if (data.referredByRole) updates.referredByRole = toReferrerRole(data.referredByRole);
      if (data.referredToRole) updates.referredToRole = toReferralRole(data.referredToRole);
      if (data.referralType) updates.referralType = toReferralType(data.referralType);
      const urgency = toUrgency(data.urgency);
      if (urgency !== undefined) updates.urgency = urgency;
      const appointmentDate = parseDate(data.appointmentDate, 'appointmentDate');
      if (appointmentDate) updates.appointmentDate = appointmentDate;
      const followUpDate = parseDate(data.followUpDate, 'followUpDate');
      if (followUpDate) updates.followUpDate = followUpDate;
      const status = toReferralStatus(data.status);
      if (status !== undefined) updates.status = status;

      const referral = await ReferralService.updateReferral(id, updates);
      res.status(200).json({ success: true, message: 'Referral updated successfully', data: referral });
    } catch (error) {
      next(error);
    }
  }

  static async acceptReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const referralId = requireParamId(req.params.id, 'Referral');
      const referral = await ReferralService.acceptReferral(referralId);
      res.status(200).json({ success: true, message: 'Referral accepted successfully', data: referral });
    } catch (error) {
      next(error);
    }
  }

  static async declineReferral(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const referralId = requireParamId(req.params.id, 'Referral');
      const referral = await ReferralService.declineReferral(referralId);
      res.status(200).json({ success: true, message: 'Referral declined successfully', data: referral });
    } catch (error) {
      next(error);
    }
  }

  static async getPatientReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = requireParamId(req.params.patientId, 'Patient');
      const referrals = await ReferralService.getPatientReferrals(patientId);
      res.status(200).json({ success: true, data: referrals });
    } catch (error) {
      next(error);
    }
  }
}

