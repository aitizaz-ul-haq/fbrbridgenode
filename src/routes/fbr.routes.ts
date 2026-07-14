import { Router } from 'express';
import {
  submitInvoiceController,
  validateInvoiceController,
} from '../controllers/fbr.controller.js';
import { requireBridgeAuth } from '../middleware/auth.middleware.js';
import { fbrRateLimiter } from '../middleware/rate-limit.middleware.js';

export const fbrRouter = Router();

// All FBR endpoints require the internal bridge bearer token and are rate limited.
fbrRouter.use(fbrRateLimiter);
fbrRouter.use(requireBridgeAuth);

fbrRouter.post('/invoices/validate', (req, res, next) => {
  validateInvoiceController(req, res).catch(next);
});

fbrRouter.post('/invoices/submit', (req, res, next) => {
  submitInvoiceController(req, res).catch(next);
});
