import { Router } from 'express';
import { TherapistController } from '../controllers/therapist.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// All authenticated users can view therapists
router.get('/', TherapistController.getTherapists);
router.get('/:id', TherapistController.getTherapistById);

// Only admins can create/update/delete therapists
router.post('/', requireAdmin, TherapistController.createTherapist);
router.put('/:id', requireAdmin, TherapistController.updateTherapist);
router.delete('/:id', requireAdmin, TherapistController.deleteTherapist);

export default router;
