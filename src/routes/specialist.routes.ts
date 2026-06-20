import { Router } from 'express';
import { SpecialistController } from '../controllers/specialist.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// All authenticated users can view specialists
router.get('/', SpecialistController.getSpecialists);
router.get('/:id', SpecialistController.getSpecialistById);

// Only admins can create/update/delete specialists
router.post('/', requireAdmin, SpecialistController.createSpecialist);
router.put('/:id', requireAdmin, SpecialistController.updateSpecialist);
router.delete('/:id', requireAdmin, SpecialistController.deleteSpecialist);

export default router;

