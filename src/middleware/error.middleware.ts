import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    requestId: req.requestId,
    error: {
      code: ErrorCodes.INVALID_REQUEST,
      message: 'Resource not found.',
    },
  });
}

/**
 * Central error handler. Logs technical detail server-side and returns a
 * generic message to the caller. Never leaks secrets or stack traces.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Body-parser payload-too-large / malformed JSON produce typed errors.
  const status = typeof (err as { status?: number }).status === 'number'
    ? (err as { status: number }).status
    : 500;

  const isClientError = status >= 400 && status < 500;

  logger.error(
    {
      requestId: req.requestId,
      status,
      err: err instanceof Error ? { message: err.message, name: err.name } : err,
    },
    'Unhandled error while processing request',
  );

  if (res.headersSent) {
    return;
  }

  res.status(isClientError ? status : 500).json({
    success: false,
    requestId: req.requestId,
    error: {
      code: isClientError ? ErrorCodes.INVALID_REQUEST : ErrorCodes.INTERNAL_ERROR,
      message: isClientError
        ? 'The request could not be processed.'
        : 'An internal error occurred.',
    },
  });
}
