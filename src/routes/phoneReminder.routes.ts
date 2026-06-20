import { Router } from 'express';
import { PhoneReminderController } from '../controllers/phoneReminder.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', PhoneReminderController.getReminders);
router.get('/templates', PhoneReminderController.getTemplates);
router.get('/:id', PhoneReminderController.getReminderById);
router.post('/', PhoneReminderController.createReminder);
router.put('/:id', PhoneReminderController.updateReminder);
router.delete('/:id', PhoneReminderController.deleteReminder);
router.post('/:id/send', PhoneReminderController.sendReminder);
router.post('/:id/cancel', PhoneReminderController.cancelReminder);

export default router;

