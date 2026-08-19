import { Router } from 'express';
import { CertificatePaymentController } from '../controllers/certificatePayment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/pesapal/health', CertificatePaymentController.getPesapalHealth);
router.get('/pesapal/callback', CertificatePaymentController.handleCallback);
router.get('/pesapal/ipn', CertificatePaymentController.handleIpn);
router.post('/pesapal/ipn', CertificatePaymentController.handleIpn);

router.use(authenticate);
router.post('/certificate', CertificatePaymentController.initiateMine);
router.get('/certificate', CertificatePaymentController.getMine);

export default router;
