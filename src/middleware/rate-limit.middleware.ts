import rateLimit from 'express-rate-limit';

/**
 * Rate limiter applied to the FBR endpoints. Trusts the standardized headers
 * so callers can observe their remaining quota.
 */
export const fbrRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'INVALID_REQUEST',
      message: 'Too many requests. Please slow down.',
    },
  },
});
