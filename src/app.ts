import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { requestId } from './middleware/request-id.middleware.js';
import { fbrRouter } from './routes/fbr.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();

  // Behind Nginx: trust the first proxy so rate limiting sees real client IPs.
  app.set('trust proxy', 1);

  app.use(helmet());

  // Strict CORS allowlist. No wildcard.
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin/non-browser requests (no Origin header).
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS policy'));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-Idempotency-Key',
      ],
    }),
  );

  // Strict body-size limit.
  app.use(express.json({ limit: '1mb' }));

  app.use(requestId);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      // Redaction is configured on the logger itself.
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  app.use('/', healthRouter);
  app.use('/api/v1/fbr', fbrRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
