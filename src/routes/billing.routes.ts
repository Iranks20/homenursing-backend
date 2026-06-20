import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/invoices', BillingController.getInvoices);
router.get('/invoices/:id', BillingController.getInvoiceById);
router.post('/invoices', BillingController.createInvoice);
router.put('/invoices/:id', BillingController.updateInvoice);
router.patch('/invoices/:id/archive', BillingController.archiveInvoice);
router.delete('/invoices/:id', requireRole(['ADMIN']), BillingController.deleteInvoice);
router.get('/payments', BillingController.getPayments);
router.get('/payments/:id', BillingController.getPaymentById);
router.post('/process-payment', BillingController.processPayment);
router.post('/generate-invoice', BillingController.generateInvoice);
router.get('/reports/revenue', BillingController.getRevenueReport);
router.get('/reports/outstanding', BillingController.getOutstandingPayments);
router.get('/reports/summary', BillingController.getBillingSummary);
router.get('/consultation-providers', BillingController.getConsultationProviders);

export default router;

