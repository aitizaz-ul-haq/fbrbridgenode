import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const IDEMPOTENCY_KEY_HEADER = 'x-idempotency-key';

// Basic sanity limits to reject malformed header values.
const MAX_HEADER_LENGTH = 200;
const SAFE_HEADER_PATTERN = /^[A-Za-z0-9._:-]+$/;

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    idempotencyKey?: string;
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Assigns a request ID (from the caller or generated) and validates the
 * optional idempotency key. Both values are echoed back on the response.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const providedId = firstHeaderValue(req.headers[REQUEST_ID_HEADER])?.trim();

  if (providedId && (providedId.length > MAX_HEADER_LENGTH || !SAFE_HEADER_PATTERN.test(providedId))) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Invalid X-Request-ID header.' },
    });
    return;
  }

  req.requestId = providedId && providedId.length > 0 ? providedId : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);

  const providedKey = firstHeaderValue(req.headers[IDEMPOTENCY_KEY_HEADER])?.trim();
  if (providedKey) {
    if (providedKey.length > MAX_HEADER_LENGTH || !SAFE_HEADER_PATTERN.test(providedKey)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid X-Idempotency-Key header.' },
      });
      return;
    }
    req.idempotencyKey = providedKey;
    res.setHeader('X-Idempotency-Key', providedKey);
  }

  next();
}
