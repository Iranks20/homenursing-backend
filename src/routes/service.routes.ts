import { Router } from 'express';
import { ServiceController } from '../controllers/service.controller';
import { ServiceCategoryController } from '../controllers/serviceCategory.controller';
import { authenticate, requireAdminOrBiller } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Service categories (place BEFORE /:id to avoid conflicts)
router.get('/categories', ServiceCategoryController.getCategories);
router.get('/categories/:id', ServiceCategoryController.getCategoryById);
router.post('/categories', requireAdminOrBiller, ServiceCategoryController.createCategory);
router.put('/categories/:id', requireAdminOrBiller, ServiceCategoryController.updateCategory);
router.delete('/categories/:id', requireAdminOrBiller, ServiceCategoryController.deleteCategory);

// Services
router.get('/', ServiceController.getServices);
router.get('/:id', ServiceController.getServiceById);

router.post('/', requireAdminOrBiller, ServiceController.createService);
router.put('/:id', requireAdminOrBiller, ServiceController.updateService);
router.delete('/:id', requireAdminOrBiller, ServiceController.deleteService);

export default router;


