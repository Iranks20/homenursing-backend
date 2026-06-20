import { Router } from 'express';
import { SecurityComplianceController } from '../controllers/securityCompliance.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

// Security Management (admin only)
router.get('/security/policies', requireAdmin, SecurityComplianceController.getSecurityPolicies);
router.put('/security/policies', requireAdmin, SecurityComplianceController.updateSecurityPolicies);
router.get('/security/incidents', requireAdmin, SecurityComplianceController.getSecurityIncidents);
router.post('/security/incidents', SecurityComplianceController.reportSecurityIncident);

// Compliance (admin only)
router.get('/compliance/audit', requireAdmin, SecurityComplianceController.getComplianceAudit);

// Privacy
router.get('/privacy/data-requests', requireAdmin, SecurityComplianceController.getDataPrivacyRequests);
router.post('/privacy/data-export/:userId?', SecurityComplianceController.exportUserData);
router.delete('/privacy/data-delete/:userId?', SecurityComplianceController.deleteUserData);

export default router;

