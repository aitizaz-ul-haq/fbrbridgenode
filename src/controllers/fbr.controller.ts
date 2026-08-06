import type { Request, Response } from 'express';
import { bridgeRequestSchema } from '../schemas/invoice.schema.js';
import { submitInvoice, validateInvoice, type FbrCallResult } from '../services/fbr.service.js';
import type { BridgeAction } from '../types/invoice.js';
import { logger, maskIdentifier } from '../utils/logger.js';
import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
  ErrorCodes,
  type BridgeEnvelope,
} from '../utils/response.js';
import { getCachedResponse, setCachedResponse } from '../utils/idempotency.js';
import { env } from '../config/env.js';

type FbrCaller = (
  invoice: Parameters<typeof validateInvoice>[0],
  overrideToken?: string,
) => Promise<FbrCallResult>;

async function handleAction(
  action: BridgeAction,
  caller: FbrCaller,
  req: Request,
  res: Response,
): Promise<void> {
  // 1. Validate the request body locally.
  const parsed = bridgeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const envelope = buildErrorEnvelope({
      requestId: req.requestId,
      action,
      httpStatus: 400,
      code: ErrorCodes.INVALID_REQUEST,
      message: 'Invoice payload failed local validation.',
    });
    res.status(400).json({
      ...envelope,
      validationErrors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const { submissionId, invoice } = parsed.data;

  // Optional per-company FBR token; falls back to the bridge env token when absent.
  const overrideTokenRaw = req.header('X-FBR-Token');
  const overrideToken = overrideTokenRaw?.trim() || undefined;

  // 2. Development-only idempotency replay protection.
  if (req.idempotencyKey) {
    const cached = getCachedResponse(action, req.idempotencyKey);
    if (cached) {
      logger.info(
        { requestId: req.requestId, action },
        'Replayed cached response for idempotency key',
      );
      res.status(cached.httpStatus).json(cached);
      return;
    }
  }

  logger.info(
    {
      requestId: req.requestId,
      submissionId: submissionId ?? null,
      action,
      mock: env.mockMode,
      seller: maskIdentifier(invoice.sellerNTNCNIC),
      buyer: maskIdentifier(invoice.buyerNTNCNIC),
    },
    'Forwarding invoice to FBR',
  );

  // 3. Forward ONLY the invoice object to FBR.
  const result = await caller(invoice, overrideToken);

  // 4. Build a consistent envelope preserving the full FBR response.
  let envelope: BridgeEnvelope;
  if (result.ok) {
    envelope = buildSuccessEnvelope({
      requestId: req.requestId,
      submissionId: submissionId ?? null,
      action,
      httpStatus: result.httpStatus,
      fbrResponse: result.fbrResponse,
      mock: result.mock,
    });
  } else {
    envelope = buildErrorEnvelope({
      requestId: req.requestId,
      submissionId: submissionId ?? null,
      action,
      httpStatus: result.httpStatus,
      code: result.errorCode ?? ErrorCodes.FBR_UNEXPECTED_RESPONSE,
      message: result.errorMessage ?? 'FBR request failed.',
      fbrResponse: result.fbrResponse,
      mock: result.mock,
    });
  }

  // 5. Cache successful/definitive responses for idempotent replay in dev.
  if (req.idempotencyKey) {
    setCachedResponse(action, req.idempotencyKey, envelope);
  }

  res.status(result.httpStatus).json(envelope);
}

export function validateInvoiceController(req: Request, res: Response): Promise<void> {
  return handleAction('validate', validateInvoice, req, res);
}

export function submitInvoiceController(req: Request, res: Response): Promise<void> {
  return handleAction('submit', submitInvoice, req, res);
}
