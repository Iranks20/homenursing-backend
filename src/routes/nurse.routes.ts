import { Router } from 'express';
import { NurseController } from '../controllers/nurse.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// All authenticated users can view nurses
router.get('/', NurseController.getNurses);
router.get('/:id', NurseController.getNurseById);

// Only admins can create/update/delete nurses
router.post('/', requireAdmin, NurseController.createNurse);
router.put('/:id', requireAdmin, NurseController.updateNurse);
router.delete('/:id', requireAdmin, NurseController.deleteNurse);

export default router;

