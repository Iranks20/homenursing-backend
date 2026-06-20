import { Router } from 'express';
import { PatientController } from '../controllers/patient.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { requireClinicalAccess } from '../middleware/clinicalAccess.middleware';

const router = Router();

router.use(authenticate);
router.use(requireClinicalAccess);

// Patient routes
router.get('/', PatientController.getPatients);
router.get('/search', PatientController.searchPatients);
router.get('/:id', PatientController.getPatientById);
router.get('/:id/dashboard', PatientController.getPatientDashboard);
router.get('/:id/timeline', PatientController.getPatientTimeline);
router.post('/:id/merge', requireRole(['ADMIN']), PatientController.mergePatients);
router.post('/', requireRole(['ADMIN', 'NURSE', 'SUPERVISOR']), PatientController.createPatient);
router.put('/:id', requireRole(['ADMIN', 'NURSE', 'SUPERVISOR']), PatientController.updatePatient);
router.patch('/:id/status', PatientController.updatePatientStatus);
router.delete('/:id', requireRole(['ADMIN']), PatientController.deletePatient);

// Medical Records
router.get('/:id/medical-history', PatientController.getMedicalHistory);
router.post('/:id/medical-history', PatientController.addMedicalRecord);
router.put('/:id/medical-history/:recordId', PatientController.updateMedicalRecord);
router.delete('/:id/medical-history/:recordId', PatientController.deleteMedicalRecord);

// Progress Records
router.get('/:id/progress', PatientController.getProgressRecords);
router.get('/:id/progress/analytics', PatientController.getProgressAnalytics);
router.post('/:id/progress', PatientController.addProgressRecord);
router.put('/:id/progress/:recordId', PatientController.updateProgressRecord);
router.delete('/:id/progress/:recordId', PatientController.deleteProgressRecord);

// Patient Cases
router.get('/:id/cases', PatientController.getPatientCases);
router.post(
  '/:id/cases',
  requireRole(['ADMIN', 'RECEPTIONIST', 'NURSE', 'SPECIALIST', 'THERAPIST']),
  PatientController.createPatientCase
);
router.put(
  '/:id/cases/:caseId',
  requireRole(['ADMIN', 'RECEPTIONIST', 'NURSE', 'SPECIALIST', 'THERAPIST']),
  PatientController.updatePatientCase
);
router.patch(
  '/:id/cases/:caseId/close',
  requireRole(['ADMIN', 'RECEPTIONIST', 'NURSE', 'SPECIALIST', 'THERAPIST']),
  PatientController.closePatientCase
);
router.post(
  '/:id/cases/:caseId/visits',
  requireRole(['ADMIN', 'RECEPTIONIST', 'NURSE', 'SPECIALIST', 'THERAPIST']),
  PatientController.logCaseVisit
);
router.get('/:id/cases/:caseId/events', PatientController.getCaseEvents);

// Medical History Export
router.get('/:id/medical-history/export', PatientController.exportMedicalHistory);

export default router;

