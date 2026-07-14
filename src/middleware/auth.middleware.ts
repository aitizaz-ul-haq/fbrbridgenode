import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ErrorCodes } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Constant-time comparison of the presented bearer token against the configured
 * bridge API key. Rejects any request lacking the correct internal token.
 */
function isValidBridgeKey(presented: string): boolean {
  const expected = Buffer.from(env.bridgeApiKey);
  const actual = Buffer.from(presented);
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

export function requireBridgeAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    logger.warn({ requestId: req.requestId }, 'Rejected request without bearer token');
    res.status(401).json({
      success: false,
      requestId: req.requestId,
      error: {
        code: ErrorCodes.UNAUTHORIZED_BRIDGE_REQUEST,
        message: 'Missing or malformed authorization header.',
      },
    });
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  if (!isValidBridgeKey(token)) {
    logger.warn({ requestId: req.requestId }, 'Rejected request with invalid bridge API key');
    res.status(401).json({
      success: false,
      requestId: req.requestId,
      error: {
        code: ErrorCodes.UNAUTHORIZED_BRIDGE_REQUEST,
        message: 'Invalid bridge credentials.',
      },
    });
    return;
  }

  next();
}
