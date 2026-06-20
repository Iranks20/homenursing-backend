import { Prisma, Patient, PatientStatus, MedicalRecord, ProgressRecord, PatientCase, CaseAction } from '@prisma/client';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/error.middleware';
import { BillingService } from './billing.service';

/** Service id used for consultation-fee invoice line items (amount = consultant's consultationFee) */
const CONSULTATION_SERVICE_ID = 'service-consultation';

export interface CreatePatientData {
  name: string;
  email?: string | null;
  phone: string;
  dateOfBirth: Date;
  address: string;
  location?: string;
  condition?: string;
  assignedNurseId?: string;
  assignedSpecialistId?: string;  // Formerly assignedDoctorId
  assignedTherapistId?: string;    // Formerly referredSpecialistId
  serviceIds?: string[]; // Array of service IDs for billing
  avatar?: string;
  status?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalHistoryNotes?: string;
  currentMedications?: string;
  allergies?: string;
  paymentType?: 'CASH' | 'INSURANCE';
  insuranceProvider?: string;
  insuranceNumber?: string;
  referralSource?: string;
}

export interface UpdatePatientData {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  address?: string;
  location?: string;
  condition?: string;
  assignedNurseId?: string;
  assignedSpecialistId?: string;  // Formerly assignedDoctorId
  assignedTherapistId?: string;    // Formerly referredSpecialistId
  serviceIds?: string[]; // Array of service IDs for billing
  avatar?: string | null;
  status?: PatientStatus;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalHistoryNotes?: string;
  currentMedications?: string;
  allergies?: string;
  paymentType?: 'CASH' | 'INSURANCE';
  insuranceProvider?: string;
  insuranceNumber?: string;
  referralSource?: string;
}

export interface PatientFilters {
  query?: string;
  status?: PatientStatus;
  assignedNurseId?: string;
  page?: number;
  limit?: number;
  // Role-based filtering
  userRole?: string;
  userId?: string;
  /** When true, include consultationFee on assignedSpecialist and assignedTherapist (for biller dashboard) */
  includeConsultationFees?: boolean;
}

export class PatientService {
  /**
   * Create an invoice for a consultant's consultation fee if the consultant has a fee set.
   * Uses the system "Consultation" service with amount = consultant's consultationFee.
   */
  private static async createConsultationFeeInvoiceIfSet(
    patientId: string,
    consultantUserId: string
  ): Promise<void> {
    if (!consultantUserId || consultantUserId.trim() === '') return;
    try {
      const consultant = await prisma.user.findUnique({
        where: { id: consultantUserId },
        select: { id: true, name: true, consultationFee: true },
      });
      if (!consultant || consultant.consultationFee == null || Number(consultant.consultationFee) <= 0) {
        return;
      }
      const consultationService = await prisma.service.findFirst({
        where: { id: CONSULTATION_SERVICE_ID, isActive: true },
      });
      if (!consultationService) {
        logger.warn('Consultation service not found; skipping consultation fee invoice');
        return;
      }
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await BillingService.createInvoice({
        patientId,
        date: new Date(),
        dueDate,
        description: `Consultation - ${consultant.name}`,
        status: 'PENDING' as any,
        lines: [
          {
            serviceId: consultationService.id,
            quantity: 1,
            unitPrice: Number(consultant.consultationFee),
            description: `Consultation - ${consultant.name}`,
          },
        ],
      });
      logger.info('Consultation fee invoice created', {
        patientId,
        consultantId: consultantUserId,
        consultantName: consultant.name,
        amount: consultant.consultationFee,
      });
    } catch (err: any) {
      logger.error('Failed to create consultation fee invoice', {
        patientId,
        consultantUserId,
        error: err?.message,
      });
    }
  }

  /**
   * Create a new patient
   */
  static async createPatient(data: CreatePatientData): Promise<Patient> {
    const emailVal = data.email?.trim() || null;
    if (emailVal) {
      const existingPatient = await prisma.patient.findUnique({
        where: { email: emailVal }
      });
      if (existingPatient) {
        throw new CustomError('Patient with this email already exists', 409);
      }
    }

    const patientData = {
      name: data.name,
      email: emailVal ?? undefined,
      phone: data.phone,
      dateOfBirth: new Date(data.dateOfBirth),
      address: data.address,
      location: data.location?.trim() || null,
      condition: data.condition ?? '',
      avatar: data.avatar ?? null,
      status: data.status ? (data.status.toUpperCase() as 'ACTIVE' | 'DISCHARGED' | 'PENDING') : 'ACTIVE',
      emergencyContact: data.emergencyContact ?? null,
      emergencyPhone: data.emergencyPhone ?? null,
      medicalHistoryNotes: data.medicalHistoryNotes ?? null,
      currentMedications: data.currentMedications ?? null,
      allergies: data.allergies ?? null,
      paymentType: data.paymentType ?? 'CASH',
      insuranceProvider: data.insuranceProvider ?? null,
      insuranceNumber: data.insuranceNumber ?? null,
      referralSource: data.referralSource ?? null,
      serviceIds: data.serviceIds ?? [],
    } as Prisma.PatientUncheckedCreateInput;

    if (data.assignedNurseId && data.assignedNurseId.trim() !== '') {
      patientData.assignedNurseId = data.assignedNurseId;
    }

    if (data.assignedSpecialistId && data.assignedSpecialistId.trim() !== '') {
      patientData.assignedSpecialistId = data.assignedSpecialistId;
    }

    if (data.assignedTherapistId && data.assignedTherapistId.trim() !== '') {
      patientData.assignedTherapistId = data.assignedTherapistId;
    }

    const patient = await prisma.patient.create({
      data: patientData,
      include: {
        assignedSpecialist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedTherapist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedNurse: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        appointments: true,
      }
    });

    // Create consultation fee invoices for assigned specialist and therapist (when they have a fee set)
    if (data.assignedSpecialistId && data.assignedSpecialistId.trim() !== '') {
      await this.createConsultationFeeInvoiceIfSet(patient.id, data.assignedSpecialistId);
    }
    if (data.assignedTherapistId && data.assignedTherapistId.trim() !== '') {
      await this.createConsultationFeeInvoiceIfSet(patient.id, data.assignedTherapistId);
    }

    // Create invoices for selected services
    if (data.serviceIds && data.serviceIds.length > 0) {
      try {
        const services = await prisma.service.findMany({
          where: { id: { in: data.serviceIds }, isActive: true }
        });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // 30 days from today

        try {
          await BillingService.createInvoice({
            patientId: patient.id,
            date: new Date(),
            dueDate,
            description: `Patient registration — ${services.length} service(s)`,
            status: 'PENDING' as any,
            lines: services.map((s) => ({
              serviceId: s.id,
              quantity: 1,
              unitPrice: Number(s.price) || 0,
              description: s.name,
            })),
          });
          logger.info('Registration invoice created', {
            patientId: patient.id,
            serviceCount: services.length,
          });
        } catch (invoiceError: any) {
          logger.error('Failed to create registration invoice', {
            error: invoiceError?.message,
            patientId: patient.id,
          });
        }
      } catch (serviceError: any) {
        logger.error('Failed to create invoices for patient services', { 
          error: serviceError?.message, 
          patientId: patient.id 
        });
        // Don't fail patient creation if invoice creation fails
      }
    }

    logger.info('Patient created', { patientId: patient.id, email: patient.email });
    return patient;
  }

  /**
   * Get patient by ID
   */
  static async getPatientById(id: string): Promise<Patient | null> {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        assignedSpecialist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedTherapist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedNurse: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        appointments: {
          take: 10,
          orderBy: { date: 'desc' }
        },
        medicalHistory: {
          take: 10,
          orderBy: { date: 'desc' }
        },
      }
    });

    return patient;
  }

  /**
   * Get all patients with pagination and filters
   * Role-based access control:
   * - ADMIN, RECEPTIONIST: See all patients
   * - DOCTOR: See only patients assigned to them
   * - SPECIALIST: See only patients referred to them
   * - NURSE: See only patients assigned to them
   */
  static async getPatients(filters: PatientFilters = {}) {
    const { query, status, assignedNurseId, page = 1, limit = 10, userRole, userId, includeConsultationFees } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {};
    
    // Role-based filtering (industry standard)
    // Normalize role to uppercase for consistent comparison
    if (userRole && userId) {
      const normalizedRole = typeof userRole === 'string' ? userRole.toUpperCase() : userRole;
      
      if (normalizedRole === 'SPECIALIST') {
        // Specialists see only patients assigned to them (formerly DOCTOR)
        where.assignedSpecialistId = userId;
        logger.info('Filtering patients for SPECIALIST', { userId, assignedSpecialistId: userId });
      } else if (normalizedRole === 'THERAPIST') {
        // Therapists see only patients assigned to them (formerly referredSpecialistId)
        where.assignedTherapistId = userId;
        logger.info('Filtering patients for THERAPIST', { userId, assignedTherapistId: userId });
      } else if (normalizedRole === 'NURSE') {
        // Nurses see ALL patients (they need to record vitals for all patients)
        // No filter applied - nurses have access to all patients
        logger.info('No filtering applied for NURSE - can see all patients', { userId, role: normalizedRole });
      }
      // ADMIN, RECEPTIONIST, and NURSE see all patients (no filter applied)
      if (normalizedRole === 'ADMIN' || normalizedRole === 'RECEPTIONIST' || normalizedRole === 'NURSE' || normalizedRole === 'SUPERVISOR') {
        logger.info('No role-based filtering applied - full access', { userId, role: normalizedRole });
      }
    }
    
    if (query) {
      const trimmed = query.trim();
      const tokens = trimmed.split(/\s+/).filter((t): t is string => t.length > 0);
      if (tokens.length >= 2) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          ...tokens.map((token) => ({
            name: { contains: token, mode: 'insensitive' as const },
          })),
        ];
      } else if (tokens.length === 1) {
        const t = tokens[0]!;
        where.OR = [
          { name: { contains: t, mode: 'insensitive' } },
          { email: { contains: t, mode: 'insensitive' } },
          { phone: { contains: t, mode: 'insensitive' } },
        ];
      }
    }

    if (status) {
      where.status = status;
    }

    // Additional nurse filter (for admin/receptionist filtering by nurse)
    if (assignedNurseId && (!userRole || userRole === 'ADMIN' || userRole === 'RECEPTIONIST' || userRole === 'SUPERVISOR')) {
      where.assignedNurseId = assignedNurseId;
    }

    const [patientRows, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedSpecialist: {
            select: {
              id: true,
              name: true,
              email: true,
              ...(includeConsultationFees && { consultationFee: true }),
            }
          },
          assignedTherapist: {
            select: {
              id: true,
              name: true,
              email: true,
              ...(includeConsultationFees && { consultationFee: true }),
            }
          },
          assignedNurse: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          appointments: {
            take: 5,
            orderBy: { date: 'desc' }
          },
          cases: {
            select: { visitsCount: true },
          },
        }
      }),
      prisma.patient.count({ where })
    ]);

    const patients = patientRows.map((row) => {
      const { cases, ...rest } = row as typeof row & {
        cases: { visitsCount: number }[];
      };
      const totalCaseVisits = (cases ?? []).reduce((sum, c) => sum + (c.visitsCount ?? 0), 0);
      return { ...rest, totalCaseVisits };
    });

    return {
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * Update patient
   */
  static async updatePatient(id: string, data: UpdatePatientData): Promise<Patient> {
    const existingPatient = await prisma.patient.findUnique({ where: { id } });
    if (!existingPatient) {
      throw new CustomError('Patient not found', 404);
    }

    if (data.email && data.email !== existingPatient.email) {
      const emailExists = await prisma.patient.findUnique({
        where: { email: data.email }
      });
      if (emailExists) {
        throw new CustomError('Email already in use', 409);
      }
    }

    const updateData: Prisma.PatientUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.location !== undefined) updateData.location = data.location?.trim() || null;
    if (data.condition !== undefined) updateData.condition = data.condition ?? '';
    if (data.assignedNurseId !== undefined) {
      // Handle empty string, null, or undefined - all should disconnect
      if (data.assignedNurseId && data.assignedNurseId.trim() !== '') {
        updateData.assignedNurse = { connect: { id: data.assignedNurseId } };
      } else {
        updateData.assignedNurse = { disconnect: true };
      }
    }
    if (data.assignedSpecialistId !== undefined) {
      // Handle empty string, null, or undefined - all should disconnect
      if (data.assignedSpecialistId && data.assignedSpecialistId.trim() !== '') {
        updateData.assignedSpecialist = { connect: { id: data.assignedSpecialistId } };
      } else {
        updateData.assignedSpecialist = { disconnect: true };
      }
    }
    if (data.assignedTherapistId !== undefined) {
      // Handle empty string, null, or undefined - all should disconnect
      if (data.assignedTherapistId && data.assignedTherapistId.trim() !== '') {
        updateData.assignedTherapist = { connect: { id: data.assignedTherapistId } };
      } else {
        updateData.assignedTherapist = { disconnect: true };
      }
    }
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }
    if (data.emergencyContact !== undefined) updateData.emergencyContact = data.emergencyContact || null;
    if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone || null;
    if (data.medicalHistoryNotes !== undefined) updateData.medicalHistoryNotes = data.medicalHistoryNotes || null;
    if (data.currentMedications !== undefined) updateData.currentMedications = data.currentMedications || null;
    if (data.allergies !== undefined) updateData.allergies = data.allergies || null;
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType;
    if (data.insuranceProvider !== undefined) updateData.insuranceProvider = data.insuranceProvider || null;
    if (data.insuranceNumber !== undefined) updateData.insuranceNumber = data.insuranceNumber || null;
    if (data.referralSource !== undefined) updateData.referralSource = data.referralSource || null;
    if (data.serviceIds !== undefined) updateData.serviceIds = data.serviceIds || [];

    const patient = await prisma.patient.update({
      where: { id },
      data: updateData,
      include: {
        assignedSpecialist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedTherapist: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        assignedNurse: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      }
    });

    // When a consultant is newly assigned (or changed), create a consultation fee invoice for them
    if (data.assignedSpecialistId !== undefined && data.assignedSpecialistId?.trim() !== '' && data.assignedSpecialistId !== existingPatient.assignedSpecialistId) {
      await this.createConsultationFeeInvoiceIfSet(patient.id, data.assignedSpecialistId);
    }
    if (data.assignedTherapistId !== undefined && data.assignedTherapistId?.trim() !== '' && data.assignedTherapistId !== existingPatient.assignedTherapistId) {
      await this.createConsultationFeeInvoiceIfSet(patient.id, data.assignedTherapistId);
    }

    logger.info('Patient updated', { patientId: patient.id });
    return patient;
  }

  /**
   * Update patient status
   */
  static async updatePatientStatus(id: string, status: PatientStatus): Promise<Patient> {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new CustomError('Patient not found', 404);
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: { status },
    });

    logger.info('Patient status updated', { patientId: patient.id, status });
    return patient;
  }

  /**
   * Delete patient (soft delete)
   */
  static async deletePatient(id: string): Promise<void> {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }

    await prisma.patient.update({
      where: { id },
      data: { status: 'DISCHARGED' }
    });

    logger.info('Patient deleted', { patientId: id });
  }

  /**
   * Search patients with role-based filtering
   */
  static async searchPatients(filters: PatientFilters) {
    // Apply same role-based filtering as getPatients
    return this.getPatients(filters);
  }

  /**
   * Get patient dashboard data
   */
  static async getPatientDashboard(patientId: string) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        appointments: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        medicalHistory: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        progressRecords: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        cases: {
          where: { status: 'OPEN' },
          take: 5,
        },
      }
    });

    if (!patient) {
      throw new CustomError('Patient not found', 404);
    }

    return patient;
  }

  /**
   * Get patient timeline
   */
  static async getPatientTimeline(patientId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Get all timeline events
    const [appointments, records, progress] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.medicalRecord.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.progressRecord.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: limit,
      }),
    ]);

    // Combine and sort by date
    const timeline = [
      ...appointments.map(a => ({ type: 'appointment', ...a, date: a.date })),
      ...records.map(r => ({ type: 'medical_record', ...r, date: r.date })),
      ...progress.map(p => ({ type: 'progress', ...p, date: p.date })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      timeline: timeline.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total: timeline.length,
        totalPages: Math.ceil(timeline.length / limit),
      }
    };
  }

  // Medical Records
  static async getMedicalHistory(patientId: string) {
    return prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  static async addMedicalRecord(patientId: string, data: any): Promise<MedicalRecord> {
    return prisma.medicalRecord.create({
      data: {
        ...data,
        patientId,
        date: new Date(data.date),
      }
    });
  }

  static async updateMedicalRecord(patientId: string, recordId: string, data: any): Promise<MedicalRecord> {
    const existing = await prisma.medicalRecord.findFirst({ where: { id: recordId, patientId } });
    if (!existing) {
      throw new CustomError('Medical record not found', 404);
    }

    return prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      }
    });
  }

  static async deleteMedicalRecord(patientId: string, recordId: string): Promise<void> {
    const existing = await prisma.medicalRecord.findFirst({ where: { id: recordId, patientId } });
    if (!existing) {
      throw new CustomError('Medical record not found', 404);
    }

    await prisma.medicalRecord.delete({ where: { id: recordId } });
  }

  // Progress Records
  static async getProgressRecords(patientId: string) {
    return prisma.progressRecord.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });
  }

  static async addProgressRecord(patientId: string, data: any): Promise<ProgressRecord> {
    return prisma.progressRecord.create({
      data: {
        ...data,
        patientId,
        date: new Date(data.date),
      }
    });
  }

  static async updateProgressRecord(patientId: string, recordId: string, data: any): Promise<ProgressRecord> {
    const existing = await prisma.progressRecord.findFirst({ where: { id: recordId, patientId } });
    if (!existing) {
      throw new CustomError('Progress record not found', 404);
    }

    return prisma.progressRecord.update({
      where: { id: recordId },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      }
    });
  }

  static async deleteProgressRecord(patientId: string, recordId: string): Promise<void> {
    const existing = await prisma.progressRecord.findFirst({ where: { id: recordId, patientId } });
    if (!existing) {
      throw new CustomError('Progress record not found', 404);
    }

    await prisma.progressRecord.delete({ where: { id: recordId } });
  }

  static async getProgressAnalytics(patientId: string) {
    const records = await prisma.progressRecord.findMany({
      where: { patientId },
      orderBy: { date: 'asc' }
    });

    // Calculate analytics (simplified)
    return {
      totalRecords: records.length,
      improvement: records.length > 1 ? 'positive' : 'neutral',
      trends: [],
      summary: 'Progress tracking data'
    };
  }

  static async getCaseEvents(patientId: string, caseId: string) {
    const case_ = await prisma.patientCase.findUnique({
      where: { id: caseId, patientId },
      include: {
        events: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!case_) {
      throw new CustomError('Case not found', 404);
    }

    return case_.events;
  }

  static async exportMedicalHistory(patientId: string) {
    const records = await this.getMedicalHistory(patientId);
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });

    // In production, generate actual export file (CSV/PDF)
    return {
      exportId: `medical_history_${patientId}_${Date.now()}`,
      patientId,
      patientName: patient?.name,
      recordCount: records.length,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/v1/patients/${patientId}/medical-history/export/download`
    };
  }

  // Patient Cases
  static async getPatientCases(patientId: string) {
    return prisma.patientCase.findMany({
      where: { patientId },
      include: {
        events: {
          orderBy: { timestamp: 'desc' }
        }
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  static async createPatientCase(patientId: string, data: any): Promise<PatientCase> {
    // Generate case number
    const caseCount = await prisma.patientCase.count();
    const caseNumber = `CASE-${String(caseCount + 1).padStart(6, '0')}`;

    return prisma.patientCase.create({
      data: {
        ...data,
        patientId,
        caseNumber,
      }
    });
  }

  static async updatePatientCase(patientId: string, caseId: string, data: any): Promise<PatientCase> {
    const existing = await prisma.patientCase.findFirst({ where: { id: caseId, patientId } });
    if (!existing) {
      throw new CustomError('Case not found', 404);
    }

    return prisma.patientCase.update({
      where: { id: caseId },
      data,
    });
  }

  static async closePatientCase(patientId: string, caseId: string): Promise<PatientCase> {
    const existing = await prisma.patientCase.findFirst({ where: { id: caseId, patientId } });
    if (!existing) {
      throw new CustomError('Case not found', 404);
    }

    return prisma.patientCase.update({
      where: { id: caseId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      }
    });
  }

  static async logCaseVisit(patientId: string, caseId: string, performedBy?: string, details?: string): Promise<PatientCase> {
    const existing = await prisma.patientCase.findFirst({ where: { id: caseId, patientId } });
    if (!existing) {
      throw new CustomError('Case not found', 404);
    }

    const updated = await prisma.patientCase.update({
      where: { id: caseId },
      data: {
        visitsCount: { increment: 1 },
        events: {
          create: {
            action: CaseAction.VISIT_LOGGED,
            performedBy: performedBy ?? null,
            details: details?.trim() ? details.trim() : null,
          },
        },
      },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    return updated;
  }

  /**
   * Merge duplicate patient records
   */
  static async mergePatients(primaryPatientId: string, duplicatePatientId: string): Promise<Patient> {
    const primaryPatient = await prisma.patient.findUnique({ where: { id: primaryPatientId } });
    const duplicatePatient = await prisma.patient.findUnique({ where: { id: duplicatePatientId } });

    if (!primaryPatient || !duplicatePatient) {
      throw new CustomError('One or both patients not found', 404);
    }

    // Transfer all related records from duplicate to primary
    await prisma.$transaction([
      // Update appointments
      prisma.appointment.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update medical records
      prisma.medicalRecord.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update progress records
      prisma.progressRecord.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update cases
      prisma.patientCase.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update health records
      prisma.healthRecordUpdate.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update invoices
      prisma.invoice.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update payments
      prisma.payment.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update feedback
      prisma.feedback.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update lab samples
      prisma.labSample.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Update referrals
      prisma.referral.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId }
      }),
      // Delete duplicate patient
      prisma.patient.delete({
        where: { id: duplicatePatientId }
      })
    ]);

    logger.info('Patients merged', { primaryPatientId, duplicatePatientId });
    return primaryPatient;
  }
}

