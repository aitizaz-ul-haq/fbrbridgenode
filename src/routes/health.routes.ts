import { Router } from 'express';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'fbr-bridge',
    environment: env.environmentLabel,
    ...(env.mockMode ? { mock: true } : {}),
  });
});
