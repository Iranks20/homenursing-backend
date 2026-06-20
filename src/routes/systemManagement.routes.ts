import { Router } from 'express';
import { SystemManagementController } from '../controllers/systemManagement.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Audit routes - require authentication
router.use(authenticate);

// Audit & Logging
router.get('/audit/logs', requireAdmin, SystemManagementController.getAuditLogs);
router.get('/audit/activities/:userId?', SystemManagementController.getUserActivities);
router.get('/audit/login-attempts', requireAdmin, SystemManagementController.getLoginAttempts);
router.post('/audit/export', requireAdmin, SystemManagementController.exportAuditLogs);

// Configuration (admin only)
router.get('/config/app', SystemManagementController.getAppConfig);
router.put('/config/app', requireAdmin, SystemManagementController.updateAppConfig);
router.get('/config/features', SystemManagementController.getFeatureFlags);
router.put('/config/features', requireAdmin, SystemManagementController.updateFeatureFlags);

// Data Management (admin only)
router.post('/data/backup', requireAdmin, SystemManagementController.createBackup);
router.post('/data/restore', requireAdmin, SystemManagementController.restoreBackup);
router.get('/data/export', requireAdmin, SystemManagementController.exportData);
router.post('/data/import', requireAdmin, SystemManagementController.importData);
router.get('/data/cleanup', requireAdmin, SystemManagementController.getCleanupRecommendations);

export default router;

