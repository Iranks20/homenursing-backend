import prisma from '../config/database';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

export class AnalyticsService {
  /**
   * Get dashboard analytics based on user role
   */
  static async getDashboardAnalytics(userId?: string, userRole?: UserRole) {
    // If no user role provided, return admin analytics (backward compatibility)
    if (!userRole || userRole === UserRole.ADMIN) {
      return this.getAdminDashboardAnalytics();
    }

    switch (userRole) {
      case UserRole.RECEPTIONIST:
        return this.getReceptionistDashboardAnalytics();
      case UserRole.SPECIALIST:
        if (!userId) throw new Error('User ID required for specialist dashboard');
        return this.getSpecialistDashboardAnalytics(userId);
      case UserRole.THERAPIST:
        if (!userId) throw new Error('User ID required for therapist dashboard');
        return this.getTherapistDashboardAnalytics(userId);
      case UserRole.NURSE:
        if (!userId) throw new Error('User ID required for nurse dashboard');
        return this.getNurseDashboardAnalytics(userId);
      case UserRole.BILLER:
        return this.getBillerDashboardAnalytics();
      default:
        return this.getAdminDashboardAnalytics();
    }
  }

  /**
   * Admin dashboard analytics
   */
  static async getAdminDashboardAnalytics() {
    const [totalPatients, totalAppointments, totalNurses, paymentsAgg, recentAppointments] =
      await Promise.all([
        prisma.patient.count({ where: { status: 'ACTIVE' } }),
        prisma.appointment.count({
          where: { status: { notIn: ['CANCELLED'] } },
        }),
        prisma.user.count({ where: { role: UserRole.NURSE, isActive: true } }),
        prisma.payment.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        prisma.appointment.findMany({
          take: 10,
          orderBy: { date: 'desc' },
          include: {
            patient: true,
            service: true,
          }
        }),
      ]);

    const completedPaymentInvoiceIds = await prisma.payment.findMany({
      where: { status: 'COMPLETED' },
      select: { invoiceId: true },
      distinct: ['invoiceId'],
    });
    const completedInvoiceIdSet = new Set(completedPaymentInvoiceIds.map((p) => p.invoiceId));

    const paidInvoicesNoPayment = await prisma.invoice.findMany({
      where: {
        status: 'PAID',
        archivedAt: null,
        id: { notIn: Array.from(completedInvoiceIdSet) },
      },
      select: { amount: true },
    });

    const paymentSum = paymentsAgg._sum.amount || 0;
    const extraRevenueFromPaidInvoices = paidInvoicesNoPayment.reduce(
      (sum, inv) => sum + inv.amount,
      0
    );
    const totalRevenue = paymentSum + extraRevenueFromPaidInvoices;

    return {
      totalPatients,
      totalAppointments,
      totalNurses,
      totalRevenue,
      recentAppointments,
    };
  }

  /**
   * Receptionist dashboard analytics
   * Receptionists see all patients (regardless of status) since they manage registrations
   */
  static async getReceptionistDashboardAnalytics() {
    const [
      totalPatients,
      activePatients,
      totalAppointments,
      todayAppointments,
      pendingInvoices,
      upcomingAppointments,
    ] = await Promise.all([
      prisma.patient.count(), // All patients regardless of status
      prisma.patient.count({ where: { status: 'ACTIVE' } }),
      prisma.appointment.count({
        where: { status: { notIn: ['CANCELLED'] } },
      }),
      prisma.appointment.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.invoice.count({
        where: { status: 'PENDING' },
      }),
      prisma.appointment.findMany({
        where: {
          date: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        take: 10,
        orderBy: { date: 'asc' },
        include: {
          patient: true,
          service: true,
        },
      }),
    ]);

    return {
      totalPatients, // All patients (includes ACTIVE, DISCHARGED, PENDING)
      activePatients, // Only active patients
      totalAppointments,
      todayAppointments,
      pendingInvoices,
      upcomingAppointments,
    };
  }

  /**
   * Specialist dashboard analytics (formerly Doctor)
   */
  static async getSpecialistDashboardAnalytics(specialistId: string) {
    const [
      assignedPatients,
      totalAppointments,
      todayAppointments,
      pendingReferrals,
      recentPatients,
    ] = await Promise.all([
      prisma.patient.count({
        where: { assignedSpecialistId: specialistId, status: 'ACTIVE' },
      }),
      prisma.appointment.count({
        where: {
          patient: { assignedSpecialistId: specialistId },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.appointment.count({
        where: {
          patient: { assignedSpecialistId: specialistId },
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.patient.count({
        where: {
          assignedSpecialistId: specialistId,
          currentStage: 'SPECIALIST_REVIEW',
          status: 'ACTIVE',
        },
      }),
      prisma.patient.findMany({
        where: { assignedSpecialistId: specialistId, status: 'ACTIVE' },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          appointments: {
            take: 1,
            orderBy: { date: 'desc' },
            include: { service: true },
          },
        },
      }),
    ]);

    return {
      assignedPatients,
      totalAppointments,
      todayAppointments,
      pendingReferrals,
      recentPatients,
    };
  }

  /**
   * Therapist dashboard analytics (patients assigned for treatment)
   */
  static async getTherapistDashboardAnalytics(therapistId: string) {
    // Get patient IDs assigned to this therapist
    const assignedPatients = await prisma.patient.findMany({
      where: { assignedTherapistId: therapistId, status: 'ACTIVE' },
      select: { id: true },
    });
    const patientIds = assignedPatients.map(p => p.id);

    const [
      totalAssignedPatients,
      totalAppointments,
      todayAppointments,
      readyForDischarge,
      recentPatients,
    ] = await Promise.all([
      prisma.patient.count({
        where: { assignedTherapistId: therapistId, status: 'ACTIVE' },
      }),
      patientIds.length > 0
        ? prisma.appointment.count({
            where: {
              patientId: { in: patientIds },
              status: { notIn: ['CANCELLED'] },
            },
          })
        : 0,
      patientIds.length > 0
        ? prisma.appointment.count({
            where: {
              patientId: { in: patientIds },
              date: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
                lt: new Date(new Date().setHours(23, 59, 59, 999)),
              },
              status: { notIn: ['CANCELLED'] },
            },
          })
        : 0,
      prisma.patient.count({
        where: {
          assignedTherapistId: therapistId,
          currentStage: 'READY_FOR_DISCHARGE',
          status: 'ACTIVE',
        },
      }),
      prisma.patient.findMany({
        where: { assignedTherapistId: therapistId, status: 'ACTIVE' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          appointments: {
            take: 1,
            orderBy: { date: 'desc' },
            include: { service: true },
          },
        },
      }),
    ]);

    return {
      assignedPatients: totalAssignedPatients,
      totalAppointments,
      todayAppointments,
      readyForDischarge,
      recentPatients,
    };
  }

  /**
   * Nurse dashboard analytics
   */
  static async getNurseDashboardAnalytics(nurseId: string) {
    const [
      assignedPatients,
      totalAppointments,
      todayAppointments,
      upcomingVisits,
      recentPatients,
    ] = await Promise.all([
      prisma.patient.count({
        where: { assignedNurseId: nurseId, status: 'ACTIVE' },
      }),
      prisma.appointment.count({
        where: {
          patient: { assignedNurseId: nurseId },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.appointment.count({
        where: {
          patient: { assignedNurseId: nurseId },
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: { notIn: ['CANCELLED'] },
        },
      }),
      prisma.appointment.count({
        where: {
          patient: { assignedNurseId: nurseId },
          date: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
      }),
      prisma.patient.findMany({
        where: { assignedNurseId: nurseId, status: 'ACTIVE' },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          appointments: {
            take: 1,
            orderBy: { date: 'desc' },
            include: { service: true },
          },
        },
      }),
    ]);

    return {
      assignedPatients,
      totalAppointments,
      todayAppointments,
      upcomingVisits,
      recentPatients,
    };
  }

  static async getAppointmentAnalytics(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [total, byStatus, upcoming] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.appointment.findMany({
        where: {
          ...where,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          date: { gte: new Date() },
        },
        take: 10,
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      total,
      byStatus,
      upcoming,
    };
  }

  static async getRevenueAnalytics(startDate?: Date, endDate?: Date) {
    const where: any = { status: 'COMPLETED' };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [totalRevenue, payments, invoices] = await Promise.all([
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where,
        take: 20,
        orderBy: { date: 'desc' },
        include: { patient: true },
      }),
      prisma.invoice.findMany({
        where: {
          status: 'PENDING',
        },
        take: 20,
        orderBy: { dueDate: 'asc' },
        include: { patient: true },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalPayments: totalRevenue._count,
      payments,
      pendingInvoices: invoices,
    };
  }

  static async getPatientAnalytics() {
    const [total, byStatus, recent] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.patient.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      byStatus,
      recent,
    };
  }

  static async getNurseAnalytics() {
    const [total, activeNurses, utilization] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.NURSE } }),
      prisma.user.count({ where: { role: UserRole.NURSE, isActive: true } }),
      prisma.appointment.groupBy({
        by: ['nurseId'],
        _count: true,
      }),
    ]);

    return {
      total,
      active: activeNurses,
      utilization,
    };
  }

  static async getOverview() {
    const [patients, appointments, nurses, revenue] = await Promise.all([
      prisma.patient.count(),
      prisma.appointment.count(),
      prisma.user.count({ where: { role: UserRole.NURSE, isActive: true } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    return {
      totalPatients: patients,
      totalAppointments: appointments,
      totalNurses: nurses,
      totalRevenue: revenue._sum.amount || 0,
    };
  }

  static async getTrends(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [patientTrends, appointmentTrends, revenueTrends] = await Promise.all([
      prisma.patient.groupBy({
        by: ['createdAt'],
        where,
        _count: true
      }),
      prisma.appointment.groupBy({
        by: ['date'],
        where,
        _count: true
      }),
      prisma.payment.groupBy({
        by: ['date'],
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    return {
      patients: patientTrends,
      appointments: appointmentTrends,
      revenue: revenueTrends,
    };
  }

  static async getPerformance() {
    const [avgAppointmentTime, completedRate, patientSatisfaction] = await Promise.all([
      // Calculate average appointment duration (simplified)
      Promise.resolve(60), // minutes
      prisma.appointment.count({
        where: { status: 'COMPLETED' }
      }).then(completed => 
        prisma.appointment.count().then(total => 
          total > 0 ? (completed / total) * 100 : 0
        )
      ),
      prisma.feedback.aggregate({
        _avg: { rating: true }
      })
    ]);

    return {
      avgAppointmentTime,
      completedRate,
      patientSatisfaction: patientSatisfaction._avg.rating || 0,
    };
  }

  static async getServicePopularity() {
    const popularServices = await prisma.appointment.groupBy({
      by: ['serviceId'],
      _count: true,
      orderBy: { _count: { serviceId: 'desc' } },
      take: 10
    });

    // Get service details
    const serviceIds = popularServices.map(s => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } }
    });

    return popularServices.map(ps => ({
      service: services.find(s => s.id === ps.serviceId),
      count: ps._count
    }));
  }

  /**
   * Biller dashboard analytics - finance and billing focused
   */
  static async getBillerDashboardAnalytics() {
    // Get all patients with services
    const patientsWithServices = await prisma.patient.findMany({
      where: {
        serviceIds: { isEmpty: false }
      },
      include: {
        payments: {
          where: { status: 'COMPLETED' }
        }
      }
    });

    // Calculate totals
    const totalPatients = patientsWithServices.length;
    
    // Get all services to calculate totals
    const allServices = await prisma.service.findMany({ where: { isActive: true } });
    const serviceMap = new Map(allServices.map(s => [s.id, s]));
    
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let overdueCount = 0;

    for (const patient of patientsWithServices) {
      const serviceIds = (patient.serviceIds || []) as string[];
      const patientTotal = serviceIds.reduce((sum, id) => {
        const service = serviceMap.get(id);
        return sum + (service?.price || 0);
      }, 0);
      
      totalRevenue += patientTotal;
      
      const paid = patient.payments.reduce((sum, p) => sum + p.amount, 0);
      totalPaid += paid;
      totalPending += (patientTotal - paid);
      
      // Check for overdue invoices
      const invoices = await prisma.invoice.findMany({
        where: { patientId: patient.id, status: 'OVERDUE' }
      });
      if (invoices.length > 0) {
        overdueCount++;
      }
    }

    // Get recent invoices
    const recentInvoices = await prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: { name: true, email: true }
        }
      }
    });

    return {
      totalPatients,
      totalRevenue,
      totalPaid,
      totalPending,
      overdueCount,
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        patientName: inv.patient.name,
        amount: inv.amount,
        status: inv.status,
        date: inv.createdAt
      }))
    };
  }
}

