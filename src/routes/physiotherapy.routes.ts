import { Router } from 'express';
import { PhysiotherapyController } from '../controllers/physiotherapy.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Assessments
router.get('/assessments', PhysiotherapyController.getAssessments);
router.get('/assessments/:id', PhysiotherapyController.getAssessmentById);
router.post('/assessments', PhysiotherapyController.createAssessment);
router.put('/assessments/:id', PhysiotherapyController.updateAssessment);
router.delete('/assessments/:id', PhysiotherapyController.deleteAssessment);

// Treatment Plans
router.get('/treatment-plans', PhysiotherapyController.getTreatmentPlans);
router.get('/treatment-plans/:id', PhysiotherapyController.getTreatmentPlanById);
router.post('/treatment-plans', PhysiotherapyController.createTreatmentPlan);
router.put('/treatment-plans/:id', PhysiotherapyController.updateTreatmentPlan);
router.delete('/treatment-plans/:id', PhysiotherapyController.deleteTreatmentPlan);

// Sessions
router.get('/sessions', PhysiotherapyController.getSessions);
router.get('/sessions/:id', PhysiotherapyController.getSessionById);
router.post('/sessions', PhysiotherapyController.createSession);
router.put('/sessions/:id', PhysiotherapyController.updateSession);
router.delete('/sessions/:id', PhysiotherapyController.deleteSession);

// Exercises and Modalities
router.get('/exercises', PhysiotherapyController.getExercises);
router.get('/modalities', PhysiotherapyController.getModalities);

export default router;

