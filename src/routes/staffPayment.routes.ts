import { Router } from 'express';
import { StaffPaymentController } from '../controllers/staffPayment.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/schedules', StaffPaymentController.listSchedules);

export default router;
