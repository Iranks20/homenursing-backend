import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { PaymentMethodController } from '../controllers/paymentMethod.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// System settings (admin only)
router.get('/system', requireAdmin, SettingsController.getSystemSettings);
router.put('/system', requireAdmin, SettingsController.updateSystemSettings);

// Notification settings
router.get('/notifications', SettingsController.getNotificationSettings);
router.put('/notifications', SettingsController.updateNotificationSettings);

// Reminder settings (admin only)
router.get('/reminders', requireAdmin, SettingsController.getReminderSettings);
router.put('/reminders', requireAdmin, SettingsController.updateReminderSettings);

router.get('/payment-methods', PaymentMethodController.getPaymentMethods);
router.get('/payment-methods/:id', PaymentMethodController.getPaymentMethodById);
router.post('/payment-methods', requireAdmin, PaymentMethodController.createPaymentMethod);
router.put('/payment-methods/:id', requireAdmin, PaymentMethodController.updatePaymentMethod);
router.delete('/payment-methods/:id', requireAdmin, PaymentMethodController.deletePaymentMethod);

// Backup and restore (admin only)
router.post('/backup', requireAdmin, SettingsController.createBackup);
router.post('/restore', requireAdmin, SettingsController.restoreBackup);

export default router;

