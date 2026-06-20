import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', FeedbackController.getFeedbacks);
router.get('/:id', FeedbackController.getFeedbackById);
router.post('/submit', FeedbackController.submitFeedback);
router.put('/:id', FeedbackController.updateFeedback);
router.delete('/:id', FeedbackController.deleteFeedback);
router.get('/patient/:patientId', FeedbackController.getPatientFeedbacks);
router.get('/service/:serviceId', FeedbackController.getServiceFeedbacks);

export default router;

