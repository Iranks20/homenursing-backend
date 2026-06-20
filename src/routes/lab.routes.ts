import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Lab Samples
router.get('/samples', LabController.getLabSamples);
router.get('/samples/:id', LabController.getLabSampleById);
router.post('/collect', LabController.collectSample);
router.put('/samples/:id', LabController.updateLabSample);
router.patch('/samples/:id/status', LabController.updateLabSample);

// Lab Results
router.get('/results', LabController.getLabResults);
router.get('/results/:id', LabController.getLabResultById);
router.post('/results', LabController.addLabResult);

export default router;

