import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * Fields that must never appear in logs. Redaction covers common header
 * shapes as well as raw token property names.
 */
const redactPaths = [
  'req.headers.authorization',
  'req.headers["x-idempotency-key"]',
  'req.headers["x-fbr-token"]',
  'headers.authorization',
  'headers["x-fbr-token"]',
  'authorization',
  'Authorization',
  '*.authorization',
  '*.Authorization',
  'fbrToken',
  'FBR_SANDBOX_TOKEN',
  'FBR_PRODUCTION_TOKEN',
  'bridgeApiKey',
  'BRIDGE_API_KEY',
  'token',
];

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

/**
 * Mask a taxpayer identifier (NTN/CNIC) for production logs, keeping only the
 * last 4 characters visible.
 */
export function maskIdentifier(value: string | undefined): string {
  if (!value) {
    return '';
  }
  if (value.length <= 4) {
    return '****';
  }
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}
