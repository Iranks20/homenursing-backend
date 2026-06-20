import { Router } from 'express';
import { SmsController } from '../controllers/sms.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN', 'RECEPTIONIST', 'BILLER']));

router.get('/automation-settings', SmsController.getAutomationSettings);
router.put('/automation-settings', SmsController.updateAutomationSettings);

router.get('/appointment-reminders', SmsController.listAppointmentReminders);
router.get('/birthday-deliveries', SmsController.listBirthdayDeliveries);

router.get('/messages', SmsController.list);
router.post('/messages', SmsController.send);
router.get('/messages/:id', SmsController.getById);

router.get('/directory', SmsController.directory);

router.get('/templates', SmsController.listTemplates);
router.post('/templates', SmsController.createTemplate);
router.delete('/templates/:id', SmsController.deleteTemplate);

export default router;
