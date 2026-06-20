import { Router } from 'express';
import { HealthRecordController } from '../controllers/healthRecord.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireClinicalAccess } from '../middleware/clinicalAccess.middleware';

const router = Router();

router.use(authenticate);
router.use(requireClinicalAccess);

router.get('/', HealthRecordController.getHealthRecords);
router.get('/patient/:patientId', HealthRecordController.getPatientHealthRecords);
router.get('/patient/:patientId/vitals', HealthRecordController.getPatientVitals);
router.get('/patient/:patientId/medications', HealthRecordController.getPatientMedications);
router.get('/patient/:patientId/symptoms', HealthRecordController.getPatientSymptoms);
router.get('/patient/:patientId/export', HealthRecordController.exportPatientHealthRecords);
router.get('/:id', HealthRecordController.getHealthRecordById);
router.post('/', HealthRecordController.createHealthRecord);
router.put('/:id', HealthRecordController.updateHealthRecord);
router.patch('/:id/verify', HealthRecordController.verifyHealthRecord);
router.delete('/:id', HealthRecordController.deleteHealthRecord);

export default router;

