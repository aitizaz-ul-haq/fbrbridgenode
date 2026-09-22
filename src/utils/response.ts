import type { BridgeAction, FbrEnvironment } from '../types/invoice.js';

/**
 * Internal error codes surfaced by the bridge. See Section 17 of the spec.
 */
export const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED_BRIDGE_REQUEST: 'UNAUTHORIZED_BRIDGE_REQUEST',
  FBR_TOKEN_MISSING: 'FBR_TOKEN_MISSING',
  FBR_VALIDATION_REJECTED: 'FBR_VALIDATION_REJECTED',
  FBR_SUBMISSION_REJECTED: 'FBR_SUBMISSION_REJECTED',
  FBR_TIMEOUT: 'FBR_TIMEOUT',
  FBR_NETWORK_ERROR: 'FBR_NETWORK_ERROR',
  FBR_UNEXPECTED_RESPONSE: 'FBR_UNEXPECTED_RESPONSE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface SuccessEnvelope {
  success: true;
  requestId: string;
  submissionId: string | null;
  environment: FbrEnvironment;
  action: BridgeAction;
  httpStatus: number;
  fbrResponse: unknown;
  receivedAt: string;
  mock?: boolean;
}

export interface ErrorEnvelope {
  success: false;
  requestId: string;
  submissionId: string | null;
  environment: FbrEnvironment;
  action: BridgeAction;
  httpStatus: number;
  error: {
    code: ErrorCode;
    message: string;
  };
  fbrResponse: unknown;
  receivedAt: string;
  mock?: boolean;
}

export type BridgeEnvelope = SuccessEnvelope | ErrorEnvelope;

interface EnvelopeBase {
  requestId: string;
  submissionId?: string | null;
  environment: FbrEnvironment;
  action: BridgeAction;
  httpStatus: number;
  fbrResponse?: unknown;
  mock?: boolean;
}

export function buildSuccessEnvelope(base: EnvelopeBase): SuccessEnvelope {
  return {
    success: true,
    requestId: base.requestId,
    submissionId: base.submissionId ?? null,
    environment: base.environment,
    action: base.action,
    httpStatus: base.httpStatus,
    fbrResponse: base.fbrResponse ?? {},
    receivedAt: new Date().toISOString(),
    ...(base.mock ? { mock: true } : {}),
  };
}

export function buildErrorEnvelope(
  base: EnvelopeBase & { code: ErrorCode; message: string },
): ErrorEnvelope {
  return {
    success: false,
    requestId: base.requestId,
    submissionId: base.submissionId ?? null,
    environment: base.environment,
    action: base.action,
    httpStatus: base.httpStatus,
    error: {
      code: base.code,
      message: base.message,
    },
    fbrResponse: base.fbrResponse ?? {},
    receivedAt: new Date().toISOString(),
    ...(base.mock ? { mock: true } : {}),
  };
}
