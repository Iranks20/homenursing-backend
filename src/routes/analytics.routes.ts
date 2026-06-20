import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/dashboard', AnalyticsController.getDashboardAnalytics);
router.get('/overview', AnalyticsController.getOverview);
router.get('/trends', AnalyticsController.getTrends);
router.get('/performance', AnalyticsController.getPerformance);
router.get('/appointments', AnalyticsController.getAppointmentAnalytics);
router.get('/revenue', AnalyticsController.getRevenueAnalytics);
router.get('/patients', AnalyticsController.getPatientAnalytics);
router.get('/nurses', AnalyticsController.getNurseAnalytics);
router.get('/service-popularity', AnalyticsController.getServicePopularity);

export default router;

