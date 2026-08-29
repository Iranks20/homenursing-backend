import { AssignmentStatus, NurseCoverageType, Prisma, UserRole } from '@prisma/client';
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

function parseOptionalDate(value: string | undefined, field: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CustomError(`Invalid ${field}`, 400);
  }
  return date;
}

async function syncPatientPrimaryNurse(
  tx: Prisma.TransactionClient,
  patientId: string,
  location?: string | null
) {
  const activeAssignments = await tx.nursePatientAssignment.findMany({
    where: { patientId, status: AssignmentStatus.ACTIVE },
    orderBy: [{ assignedAt: 'asc' }],
    select: { nurseId: true },
  });

  await tx.patient.update({
    where: { id: patientId },
    data: {
      assignedNurseId: activeAssignments[0]?.nurseId ?? null,
      ...(location ? { location } : {}),
    },
  });
}

function formatAssignment(record: any) {
  return {
    id: record.id,
    patientId: record.patientId,
    nurseId: record.nurseId,
    assignedById: record.assignedById,
    assignedAt: record.assignedAt.toISOString(),
    location: record.location ?? undefined,
    notes: record.notes ?? undefined,
    coverageType: record.coverageType,
    periodStart: record.periodStart?.toISOString(),
    periodEnd: record.periodEnd?.toISOString(),
    scheduleNotes: record.scheduleNotes ?? undefined,
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
      coverageType?: NurseCoverageType;
      periodStart?: string;
      periodEnd?: string;
      scheduleNotes?: string;
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

    const existingActive = await prisma.nursePatientAssignment.findFirst({
      where: {
        patientId: input.patientId,
        nurseId: input.nurseId,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (existingActive) {
      throw new CustomError('This nurse is already actively assigned to this patient', 400);
    }

    const location = input.location?.trim() || patient.location || patient.address;
    const assignedAt = input.assignedAt ? new Date(input.assignedAt) : new Date();
    if (Number.isNaN(assignedAt.getTime())) {
      throw new CustomError('Invalid assignment date', 400);
    }

    const periodStart = parseOptionalDate(input.periodStart, 'period start date');
    const periodEnd = parseOptionalDate(input.periodEnd, 'period end date');
    if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) {
      throw new CustomError('Coverage end date must be on or after the start date', 400);
    }

    const coverageType = input.coverageType ?? NurseCoverageType.SIMULTANEOUS;

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.nursePatientAssignment.create({
        data: {
          patientId: input.patientId,
          nurseId: input.nurseId,
          assignedById: supervisorId,
          assignedAt,
          location,
          notes: input.notes?.trim() || null,
          coverageType,
          periodStart,
          periodEnd,
          scheduleNotes: input.scheduleNotes?.trim() || null,
          status: AssignmentStatus.ACTIVE,
        },
        include: assignmentInclude,
      });

      await syncPatientPrimaryNurse(tx, input.patientId, location);

      return created;
    });

    logger.info('Nurse assigned to patient', {
      assignmentId: assignment.id,
      patientId: input.patientId,
      nurseId: input.nurseId,
      supervisorId,
      coverageType,
    });

    return formatAssignment(assignment);
  }

  static async endAssignment(supervisorId: string, assignmentId: string) {
    const assignment = await prisma.nursePatientAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new CustomError('Assignment not found', 404);
    }
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new CustomError('Assignment is already ended', 400);
    }

    const endedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.nursePatientAssignment.update({
        where: { id: assignmentId },
        data: {
          status: AssignmentStatus.ENDED,
          endedAt,
        },
        include: assignmentInclude,
      });

      await syncPatientPrimaryNurse(tx, assignment.patientId);

      return record;
    });

    logger.info('Nurse assignment ended', {
      assignmentId,
      patientId: assignment.patientId,
      nurseId: assignment.nurseId,
      supervisorId,
    });

    return formatAssignment(updated);
  }

  static async updateAssignment(
    supervisorId: string,
    assignmentId: string,
    input: {
      nurseId?: string;
      location?: string | null;
      notes?: string | null;
      assignedAt?: string;
      coverageType?: NurseCoverageType;
      periodStart?: string | null;
      periodEnd?: string | null;
      scheduleNotes?: string | null;
    }
  ) {
    const existing = await prisma.nursePatientAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!existing) {
      throw new CustomError('Assignment not found', 404);
    }
    if (existing.status !== AssignmentStatus.ACTIVE) {
      throw new CustomError('Only active assignments can be edited', 400);
    }

    const nextNurseId = input.nurseId ?? existing.nurseId;
    if (nextNurseId !== existing.nurseId) {
      const nurseUser = await prisma.user.findUnique({ where: { id: nextNurseId } });
      if (!nurseUser || nurseUser.role !== UserRole.NURSE) {
        throw new CustomError('Selected nurse is not valid', 400);
      }
      const duplicate = await prisma.nursePatientAssignment.findFirst({
        where: {
          patientId: existing.patientId,
          nurseId: nextNurseId,
          status: AssignmentStatus.ACTIVE,
          id: { not: assignmentId },
        },
      });
      if (duplicate) {
        throw new CustomError('This nurse is already actively assigned to this patient', 400);
      }
    }

    let assignedAt = existing.assignedAt;
    if (input.assignedAt !== undefined) {
      assignedAt = new Date(input.assignedAt);
      if (Number.isNaN(assignedAt.getTime())) {
        throw new CustomError('Invalid assignment date', 400);
      }
    }

    const periodStart =
      input.periodStart === undefined
        ? existing.periodStart
        : input.periodStart
        ? parseOptionalDate(input.periodStart, 'period start date')
        : null;
    const periodEnd =
      input.periodEnd === undefined
        ? existing.periodEnd
        : input.periodEnd
        ? parseOptionalDate(input.periodEnd, 'period end date')
        : null;
    if (periodStart && periodEnd && periodStart.getTime() > periodEnd.getTime()) {
      throw new CustomError('Coverage end date must be on or after the start date', 400);
    }

    const location =
      input.location === undefined
        ? existing.location
        : input.location?.trim()
        ? input.location.trim()
        : null;

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.nursePatientAssignment.update({
        where: { id: assignmentId },
        data: {
          nurseId: nextNurseId,
          assignedAt,
          location,
          notes:
            input.notes === undefined
              ? existing.notes
              : input.notes?.trim()
              ? input.notes.trim()
              : null,
          coverageType: input.coverageType ?? existing.coverageType,
          periodStart,
          periodEnd,
          scheduleNotes:
            input.scheduleNotes === undefined
              ? existing.scheduleNotes
              : input.scheduleNotes?.trim()
              ? input.scheduleNotes.trim()
              : null,
        },
        include: assignmentInclude,
      });

      await syncPatientPrimaryNurse(tx, existing.patientId, location ?? undefined);

      return record;
    });

    logger.info('Nurse assignment updated', {
      assignmentId,
      patientId: existing.patientId,
      nurseId: nextNurseId,
      supervisorId,
    });

    return formatAssignment(updated);
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
