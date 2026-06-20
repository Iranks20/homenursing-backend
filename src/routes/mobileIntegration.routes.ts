import { Router } from 'express';
import { MobileIntegrationController } from '../controllers/mobileIntegration.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Mobile config doesn't require auth (public endpoint)
router.get('/mobile/config', MobileIntegrationController.getMobileConfig);

// Other mobile routes require authentication
router.post('/mobile/push-token', authenticate, MobileIntegrationController.registerPushToken);
router.get('/mobile/offline-sync', authenticate, MobileIntegrationController.getOfflineSyncData);

// Integrations
router.get('/integrations/available', authenticate, MobileIntegrationController.getAvailableIntegrations);
router.post('/integrations/connect', authenticate, MobileIntegrationController.connectIntegration);
router.post('/integrations/webhook/:integrationId?', MobileIntegrationController.handleWebhook);

export default router;

