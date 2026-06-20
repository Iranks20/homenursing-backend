import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/custom', ReportsController.generateCustomReport);
router.post('/custom', ReportsController.generateCustomReport);
router.post('/schedule', requireAdmin, ReportsController.scheduleReport);
router.get('/templates', ReportsController.getReportTemplates);
router.post('/templates', requireAdmin, ReportsController.createReportTemplate);
router.get('/appointments', ReportsController.getAppointmentReport);
router.get('/revenue', ReportsController.getRevenueReport);
router.get('/patient-satisfaction', ReportsController.getPatientSatisfactionReport);
router.get('/nurse-utilization', ReportsController.getNurseUtilizationReport);
router.get('/export/:type', ReportsController.exportReport);

export default router;

