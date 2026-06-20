import { Prisma, HealthRecordUpdate, RecordType, RecordRole } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';

export interface CreateHealthRecordData {
  patientId: string;
  updatedBy: string;
  updatedByName: string;
  updatedByRole: RecordRole;
  recordType: RecordType;
  data: Prisma.InputJsonValue;
  location?: string;
  notes?: string;
}

export interface HealthRecordFilters {
  patientId?: string;
  recordType?: RecordType;
  verified?: boolean;
  page?: number;
  limit?: number;
  restrictedToAssignedSpecialistId?: string;
}

export interface HealthRecordCreateOptions {
  restrictSpecialistUserId?: string;
}

export class HealthRecordService {
  static async assertSpecialistAssignedToPatient(specialistUserId: string, patientId: string): Promise<void> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { assignedSpecialistId: true },
    });
    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }
    if (patient.assignedSpecialistId !== specialistUserId) {
      throw new CustomError('Access denied - patient not assigned to you', 403);
    }
  }

  static async assertSpecialistCanAccessHealthRecord(recordId: string, specialistUserId: string): Promise<void> {
    const existing = await prisma.healthRecordUpdate.findUnique({
      where: { id: recordId },
      include: { patient: true },
    });
    if (!existing) {
      throw new CustomError('Health record not found', 404);
    }
    if (existing.patient.assignedSpecialistId !== specialistUserId) {
      throw new CustomError('Access denied', 403);
    }
  }

  static async createHealthRecord(
    data: CreateHealthRecordData,
    options?: HealthRecordCreateOptions
  ): Promise<HealthRecordUpdate> {
    const patient = await prisma.patient.findUnique({ where: { id: data.patientId } });
    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }
    if (options?.restrictSpecialistUserId) {
      await this.assertSpecialistAssignedToPatient(options.restrictSpecialistUserId, data.patientId);
    }

    const record = await prisma.healthRecordUpdate.create({
      data,
      include: {
        patient: true,
      }
    });

    logger.info('Health record created', { recordId: record.id });
    return record;
  }

  static async getHealthRecordById(id: string): Promise<HealthRecordUpdate | null> {
    return prisma.healthRecordUpdate.findUnique({
      where: { id },
      include: {
        patient: true,
      }
    });
  }

  static async getHealthRecords(filters: HealthRecordFilters = {}) {
    const { patientId, recordType, verified, page = 1, limit = 10, restrictedToAssignedSpecialistId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.HealthRecordUpdateWhereInput = {};
    
    if (patientId) where.patientId = patientId;
    if (recordType) where.recordType = recordType;
    if (verified !== undefined) where.verified = verified;
    if (restrictedToAssignedSpecialistId) {
      where.patient = {
        is: { assignedSpecialistId: restrictedToAssignedSpecialistId },
      };
    }

    const [records, total] = await Promise.all([
      prisma.healthRecordUpdate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          patient: true,
        }
      }),
      prisma.healthRecordUpdate.count({ where })
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  static async updateHealthRecord(
    id: string,
    data: Partial<CreateHealthRecordData> & { verified?: boolean; verifiedBy?: string },
    options?: { restrictSpecialistUserId?: string }
  ): Promise<HealthRecordUpdate> {
    if (options?.restrictSpecialistUserId) {
      await this.assertSpecialistCanAccessHealthRecord(id, options.restrictSpecialistUserId);
    }
    const existing = await prisma.healthRecordUpdate.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Health record not found', 404);
    }

    const updateData: Prisma.HealthRecordUpdateUpdateInput = {};
    if (data.location !== undefined) updateData.location = data.location;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.data !== undefined) updateData.data = data.data;
    if (data.recordType !== undefined) updateData.recordType = data.recordType;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;
    if (data.updatedByName !== undefined) updateData.updatedByName = data.updatedByName;
    if (data.updatedByRole !== undefined) updateData.updatedByRole = data.updatedByRole;

    if (data.verified !== undefined) {
      updateData.verified = data.verified;
      updateData.verifiedAt = data.verified ? new Date() : null;
      if (data.verifiedBy !== undefined) updateData.verifiedBy = data.verifiedBy;
    }

    return prisma.healthRecordUpdate.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteHealthRecord(id: string, options?: { restrictSpecialistUserId?: string }): Promise<void> {
    if (options?.restrictSpecialistUserId) {
      await this.assertSpecialistCanAccessHealthRecord(id, options.restrictSpecialistUserId);
    }
    const existing = await prisma.healthRecordUpdate.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Health record not found', 404);
    }

    await prisma.healthRecordUpdate.delete({
      where: { id }
    });
  }

  static async getPatientHealthRecords(patientId: string) {
    return prisma.healthRecordUpdate.findMany({
      where: { patientId },
      orderBy: { timestamp: 'desc' },
    });
  }

  static async getPatientVitals(patientId: string) {
    return prisma.healthRecordUpdate.findMany({
      where: {
        patientId,
        recordType: 'VITAL',
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  static async getPatientMedications(patientId: string) {
    return prisma.healthRecordUpdate.findMany({
      where: {
        patientId,
        recordType: 'MEDICATION',
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  static async getPatientSymptoms(patientId: string) {
    return prisma.healthRecordUpdate.findMany({
      where: {
        patientId,
        recordType: 'SYMPTOM',
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  static async verifyHealthRecord(
    id: string,
    verifiedBy: string,
    notes?: string,
    options?: { restrictSpecialistUserId?: string }
  ): Promise<HealthRecordUpdate> {
    if (options?.restrictSpecialistUserId) {
      await this.assertSpecialistCanAccessHealthRecord(id, options.restrictSpecialistUserId);
    }
    const existing = await prisma.healthRecordUpdate.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Health record not found', 404);
    }

    return prisma.healthRecordUpdate.update({
      where: { id },
      data: {
        verified: true,
        verifiedBy,
        verifiedAt: new Date(),
        notes: notes ? (existing.notes ? `${existing.notes}\n${notes}` : notes) : existing.notes,
      }
    });
  }

  static async exportPatientHealthRecords(patientId: string) {
    const records = await this.getPatientHealthRecords(patientId);
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    // In production, generate actual export file (CSV/PDF)
    return {
      exportId: `health_records_${patientId}_${Date.now()}`,
      patientId,
      patientName: patient?.name ?? 'Unknown',
      recordCount: records.length,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/v1/health-records/patient/${patientId}/export/download`
    };
  }
}

