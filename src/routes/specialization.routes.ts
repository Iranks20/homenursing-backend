import { Router } from 'express';
import { SpecializationController } from '../controllers/specialization.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// All authenticated users can view specializations
router.get('/', SpecializationController.getSpecializations);
router.get('/:id', SpecializationController.getSpecializationById);

// Only admins can create/update/delete specializations
router.post('/', requireAdmin, SpecializationController.createSpecialization);
router.put('/:id', requireAdmin, SpecializationController.updateSpecialization);
router.delete('/:id', requireAdmin, SpecializationController.deleteSpecialization);

export default router;
