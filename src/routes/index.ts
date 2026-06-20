import { Router } from 'express';
import prisma from '../config/database';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import patientRoutes from './patient.routes';
import nurseRoutes from './nurse.routes';
import healthRecordRoutes from './healthRecord.routes';
import notificationRoutes from './notification.routes';
import uploadRoutes from './upload.routes';
import settingsRoutes from './settings.routes';
import trainingRoutes from './training.routes';
import applicationRoutes from './application.routes';
import supervisionRoutes from './supervision.routes';
import labRoutes from './lab.routes';
import referralRoutes from './referral.routes';
import staffPaymentRoutes from './staffPayment.routes';

const router = Router();

router.get('/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

router.get('/v1/health/detailed', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy',
        api: 'healthy',
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service check failed',
    });
  }
});

router.get('/v1/metrics', (req, res) => {
  res.status(200).json({
    success: true,
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    },
  });
});

router.get('/v1/status', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/v1', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Teamwork Home Nursing API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth/*',
      users: '/api/v1/users/*',
      patients: '/api/v1/patients/*',
      nurses: '/api/v1/nurses/*',
      healthRecords: '/api/v1/health-records/*',
      notifications: '/api/v1/notifications/*',
      upload: '/api/v1/upload/*',
      settings: '/api/v1/settings/*',
      training: '/api/v1/training/*',
      applications: '/api/v1/applications/*',
      supervision: '/api/v1/supervision/*',
      lab: '/api/v1/lab/*',
      referrals: '/api/v1/referrals/*',
      staffPayments: '/api/v1/staff-payments/*',
    },
  });
});

router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/patients', patientRoutes);
router.use('/v1/nurses', nurseRoutes);
router.use('/v1/health-records', healthRecordRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/upload', uploadRoutes);
router.use('/v1/settings', settingsRoutes);
router.use('/v1/training', trainingRoutes);
router.use('/v1/applications', applicationRoutes);
router.use('/v1/supervision', supervisionRoutes);
router.use('/v1/lab', labRoutes);
router.use('/v1/referrals', referralRoutes);
router.use('/v1/staff-payments', staffPaymentRoutes);

export default router;
