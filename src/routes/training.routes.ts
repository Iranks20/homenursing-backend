import { Router } from 'express';
import { TrainingController } from '../controllers/training.controller';
import { ExamController } from '../controllers/exam.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

const requireExamManager = requireRole(['ADMIN', 'TRAINER']);
const requireExamTaker = requireRole(['ADMIN', 'NURSE', 'APPLICANT']);
const requireStaffTraining = requireRole(['ADMIN', 'NURSE', 'TRAINER', 'APPLICANT']);

router.get('/classes', requireStaffTraining, TrainingController.getClasses);
router.get('/classes/:id', requireStaffTraining, TrainingController.getClassById);
router.post('/classes', requireExamManager, TrainingController.createClass);
router.put('/classes/:id', requireExamManager, TrainingController.updateClass);
router.delete('/classes/:id', requireExamManager, TrainingController.deleteClass);
router.post('/classes/:id/enroll', requireRole(['ADMIN', 'NURSE', 'APPLICANT']), TrainingController.enrollInClass);

router.get('/exams', requireStaffTraining, TrainingController.getExams);
router.get('/exams/:id', requireStaffTraining, TrainingController.getExamById);
router.post('/exams', requireExamManager, TrainingController.createExam);
router.put('/exams/:id', requireExamManager, TrainingController.updateExam);
router.delete('/exams/:id', requireExamManager, TrainingController.deleteExam);
router.post('/exams/:id/submit', requireExamTaker, TrainingController.submitExam);

router.get('/exams-v2', requireRole(['ADMIN', 'NURSE', 'TRAINER', 'APPLICANT']), ExamController.getExams);
router.get('/exams-v2/:id', requireRole(['ADMIN', 'NURSE', 'TRAINER', 'APPLICANT']), ExamController.getExamById);
router.post('/exams-v2', requireExamManager, ExamController.createExam);
router.put('/exams-v2/:id', requireExamManager, ExamController.updateExam);
router.delete('/exams-v2/:id', requireExamManager, ExamController.deleteExam);
router.post('/exams-v2/:id/start', requireExamTaker, ExamController.startAttempt);
router.post('/attempts/:id/submit', requireExamTaker, ExamController.submitAttempt);
router.get('/attempts', requireRole(['ADMIN', 'TRAINER', 'NURSE', 'APPLICANT']), ExamController.getAttempts);
router.get('/attempts/:id', requireRole(['ADMIN', 'TRAINER', 'NURSE', 'APPLICANT']), ExamController.getAttemptById);
router.get('/certificates', requireExamManager, ExamController.getCertificates);
router.get('/certificates/mine', requireExamTaker, ExamController.getMyCertificates);
router.get('/certificates/:id', requireRole(['ADMIN', 'TRAINER', 'NURSE', 'APPLICANT']), ExamController.getCertificateById);
router.post('/certificates/:id/approve', requireExamManager, ExamController.approveCertificate);

router.get('/certifications', requireStaffTraining, TrainingController.getCertifications);
router.get('/certifications/:id', requireStaffTraining, TrainingController.getCertificationById);
router.post('/certifications', requireExamManager, TrainingController.createCertification);
router.put('/certifications/:id', requireExamManager, TrainingController.updateCertification);
router.delete('/certifications/:id', requireExamManager, TrainingController.deleteCertification);

export default router;
