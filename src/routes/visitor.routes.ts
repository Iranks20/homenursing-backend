import { Router } from 'express';
import { VisitorController } from '../controllers/visitor.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN', 'RECEPTIONIST', 'BILLER']));

router.get('/', VisitorController.getVisitors);
router.get('/:id', VisitorController.getVisitorById);
router.post('/', VisitorController.createVisitor);
router.put('/:id', VisitorController.updateVisitor);
router.delete('/:id', VisitorController.deleteVisitor);

export default router;
