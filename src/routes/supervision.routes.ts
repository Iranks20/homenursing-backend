import { Router } from 'express';
import { SupervisionController } from '../controllers/supervision.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { requireClinicalAccess } from '../middleware/clinicalAccess.middleware';

const router = Router();

router.use(authenticate);
router.use(requireClinicalAccess);

const supervisorStaff = requireRole(['ADMIN', 'SUPERVISOR']);

router.get('/assignments', supervisorStaff, SupervisionController.listAssignments);
router.post('/assignments', supervisorStaff, SupervisionController.assignNurse);
router.put('/assignments/:id', supervisorStaff, SupervisionController.updateAssignment);
router.patch('/assignments/:id/end', supervisorStaff, SupervisionController.endAssignment);
router.get('/reports', supervisorStaff, SupervisionController.listReports);
router.post('/reports', supervisorStaff, SupervisionController.createReport);

export default router;
