import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.get('/preferences', NotificationController.getPreferences);
router.put('/preferences', NotificationController.updatePreferences);
router.post('/test', NotificationController.sendTest);
router.get('/history', NotificationController.getHistory);
router.patch('/bulk-read', NotificationController.bulkMarkAsRead);
router.delete('/bulk-delete', NotificationController.bulkDelete);
router.post('/', NotificationController.createNotification);
router.get('/:id', NotificationController.getNotificationById);
router.patch('/:id/read', NotificationController.markAsRead);
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;

