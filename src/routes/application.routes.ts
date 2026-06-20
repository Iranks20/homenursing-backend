import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApplicationController } from '../controllers/application.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { uploadQualificationDocuments } from '../middleware/applicationUpload.middleware';

const router = Router();

const publicApplyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many applications from this IP. Please try again later.' },
});

router.post('/public', publicApplyLimiter, uploadQualificationDocuments, ApplicationController.submitPublic);

router.use(authenticate);

router.get('/me', ApplicationController.getMine);
router.post('/me/interview-booking', ApplicationController.bookInterview);

router.get('/', requireRole(['ADMIN', 'TRAINER']), ApplicationController.list);
router.patch('/:id/interview-result', requireRole(['ADMIN', 'TRAINER']), ApplicationController.recordInterviewResult);
router.patch('/:id/recruit', requireRole(['ADMIN', 'TRAINER']), ApplicationController.markRecruited);

export default router;
