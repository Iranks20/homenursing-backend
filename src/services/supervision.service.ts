import { AssignmentStatus, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { CustomError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const assignmentInclude = {
  patient: {
    select: {
      id: true,
      name: true,
      phone: true,
      location: true,
      address: true,
      condition: true,
    },
  },
  nurse: {
    select: { id: true, name: true, email: true, phone: true },
  },
  assignedBy: {
    select: { id: true, name: true },
  },
};

const reportInclude = {
  nurse: { select: { id: true, name: true, email: true } },
  patient: { select: { id: true, name: true, location: true } },
  supervisor: { select: { id: true, name: true } },
};

function formatAssignment(record: any) {
  return {
    id: record.id,
    patientId: record.patientId,
    nurseId: record.nurseId,
    assignedById: record.assignedById,
    assignedAt: record.assignedAt.toISOString(),
    location: record.location ?? undefined,
    notes: record.notes ?? undefined,
    status: record.status,
    endedAt: record.endedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    patientName: record.patient?.name,
    patientPhone: record.patient?.phone,
    patientAddress: record.patient?.address,
    patientCondition: record.patient?.condition,
    nurseName: record.nurse?.name,
    nurseEmail: record.nurse?.email,
    assignedByName: record.assignedBy?.name,
  };
}

function formatReport(record: any) {
  return {
    id: record.id,
    supervisorId: record.supervisorId,
    nurseId: record.nurseId,
    patientId: record.patientId ?? undefined,
    title: record.title,
    content: record.content,
    visitDate: record.visitDate?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    nurseName: record.nurse?.name,
    patientName: record.patient?.name,
    supervisorName: record.supervisor?.name,
  };
}

export class SupervisionService {
  static async assignNurse(
    supervisorId: string,
    input: {
      patientId: string;
      nurseId: string;
      location?: string;
      notes?: string;
      assignedAt?: string;
    }
  ) {
    const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }

    const nurseUser = await prisma.user.findUnique({ where: { id: input.nurseId } });
    if (!nurseUser || nurseUser.role !== UserRole.NURSE) {
      throw new CustomError('Selected nurse is not valid', 400);
    }

    const location = input.location?.trim() || patient.location || patient.address;
    const assignedAt = input.assignedAt ? new Date(input.assignedAt) : new Date();
    if (Number.isNaN(assignedAt.getTime())) {
      throw new CustomError('Invalid assignment date', 400);
    }

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.nursePatientAssignment.updateMany({
        where: { patientId: input.patientId, status: AssignmentStatus.ACTIVE },
        data: { status: AssignmentStatus.ENDED, endedAt: assignedAt },
      });

      const created = await tx.nursePatientAssignment.create({
        data: {
          patientId: input.patientId,
          nurseId: input.nurseId,
          assignedById: supervisorId,
          assignedAt,
          location,
          notes: input.notes?.trim() || null,
          status: AssignmentStatus.ACTIVE,
        },
        include: assignmentInclude,
      });

      await tx.patient.update({
        where: { id: input.patientId },
        data: {
          assignedNurseId: input.nurseId,
          location,
        },
      });

      return created;
    });

    logger.info('Nurse assigned to patient', {
      assignmentId: assignment.id,
      patientId: input.patientId,
      nurseId: input.nurseId,
      supervisorId,
    });

    return formatAssignment(assignment);
  }

  static async listAssignments(filters: {
    nurseId?: string;
    patientId?: string;
    status?: AssignmentStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;
    const where: {
      nurseId?: string;
      patientId?: string;
      status?: AssignmentStatus;
    } = {};

    if (filters.nurseId) where.nurseId = filters.nurseId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;

    const [records, total] = await Promise.all([
      prisma.nursePatientAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ assignedAt: 'desc' }],
        include: assignmentInclude,
      }),
      prisma.nursePatientAssignment.count({ where }),
    ]);

    return {
      assignments: records.map(formatAssignment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async createReport(
    supervisorId: string,
    input: {
      nurseId: string;
      patientId?: string;
      title: string;
      content: string;
      visitDate?: string;
    }
  ) {
    const nurseUser = await prisma.user.findUnique({ where: { id: input.nurseId } });
    if (!nurseUser || nurseUser.role !== UserRole.NURSE) {
      throw new CustomError('Selected nurse is not valid', 400);
    }

    if (input.patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: input.patientId } });
      if (!patient) {
        throw new CustomError('Patient not found', 404);
      }
    }

    const visitDate = input.visitDate ? new Date(input.visitDate) : null;
    if (visitDate && Number.isNaN(visitDate.getTime())) {
      throw new CustomError('Invalid visit date', 400);
    }

    const report = await prisma.nurseSupervisionReport.create({
      data: {
        supervisorId,
        nurseId: input.nurseId,
        patientId: input.patientId || null,
        title: input.title.trim(),
        content: input.content.trim(),
        visitDate,
      },
      include: reportInclude,
    });

    return formatReport(report);
  }

  static async listReports(filters: {
    nurseId?: string;
    patientId?: string;
    supervisorId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = (page - 1) * limit;
    const where: {
      nurseId?: string;
      patientId?: string;
      supervisorId?: string;
    } = {};

    if (filters.nurseId) where.nurseId = filters.nurseId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.supervisorId) where.supervisorId = filters.supervisorId;

    const [records, total] = await Promise.all([
      prisma.nurseSupervisionReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
        include: reportInclude,
      }),
      prisma.nurseSupervisionReport.count({ where }),
    ]);

    return {
      reports: records.map(formatReport),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export default SupervisionService;
