import { Router } from 'express';
import { ReferralController } from '../controllers/lab.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', ReferralController.getReferrals);
router.get('/:id', ReferralController.getReferralById);
router.post('/send', ReferralController.sendReferral);
router.put('/:id', ReferralController.updateReferral);
router.patch('/:id/accept', ReferralController.acceptReferral);
router.patch('/:id/decline', ReferralController.declineReferral);
router.get('/patient/:patientId', ReferralController.getPatientReferrals);

export default router;

