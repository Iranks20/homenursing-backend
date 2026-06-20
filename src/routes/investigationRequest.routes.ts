import { Router } from 'express';
import { InvestigationRequestController } from '../controllers/investigationRequest.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Receptionist, biller, specialist, therapist, admin can create; lab attendant and admin can update
router.post('/', authorize('ADMIN', 'RECEPTIONIST', 'BILLER', 'SPECIALIST', 'THERAPIST'), InvestigationRequestController.create);
router.get('/', InvestigationRequestController.list);
router.get('/:id', InvestigationRequestController.getById);
router.patch('/:id', authorize('ADMIN', 'LAB_ATTENDANT'), InvestigationRequestController.update);

export default router;
