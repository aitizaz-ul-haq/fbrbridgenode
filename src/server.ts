import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.port, env.host, () => {
  logger.info(
    {
      host: env.host,
      port: env.port,
      environment: env.environmentLabel,
      mockMode: env.mockMode,
    },
    'FBR bridge listening',
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down FBR bridge');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
  // Force exit if graceful shutdown stalls.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
