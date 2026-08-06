import axios, { AxiosError, type AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import type { BridgeAction, FbrInvoice } from '../types/invoice.js';
import { ErrorCodes, type ErrorCode } from '../utils/response.js';

const VALIDATE_PATH = '/validateinvoicedata_sb';
const SUBMIT_PATH = '/postinvoicedata_sb';

/**
 * Result of an FBR call. The bridge always preserves the raw FBR response body
 * and HTTP status; it does not assume any receipt/reference property names.
 */
export interface FbrCallResult {
  ok: boolean;
  httpStatus: number;
  fbrResponse: unknown;
  errorCode?: ErrorCode;
  errorMessage?: string;
  mock?: boolean;
}

let cachedClient: AxiosInstance | null = null;

/**
 * Lazily build the Axios client so tests and mock mode do not require a token.
 * The bearer token is attached per-request; the client config is never logged.
 */
function getClient(): AxiosInstance {
  if (cachedClient) {
    return cachedClient;
  }
  cachedClient = axios.create({
    baseURL: env.fbrBaseUrl,
    timeout: env.requestTimeoutMs,
    headers: {
      'Content-Type': 'application/json',
    },
    // Do not throw on non-2xx: we preserve the FBR body and status ourselves.
    validateStatus: () => true,
  });
  return cachedClient;
}

function buildMockResult(action: BridgeAction): FbrCallResult {
  return {
    ok: true,
    httpStatus: 200,
    mock: true,
    fbrResponse: {
      message: action === 'validate' ? 'Mock validation successful' : 'Mock submission successful',
      reference: 'MOCK-12345',
    },
  };
}

async function callFbr(
  action: BridgeAction,
  invoice: FbrInvoice,
  overrideToken?: string,
): Promise<FbrCallResult> {
  if (env.mockMode) {
    return buildMockResult(action);
  }

  // Per-company token (sent by the main app) takes precedence over the bridge's
  // default env token so each seller submits under its own FBR-issued token.
  const token = overrideToken?.trim() || env.fbrSandboxToken;

  if (!token) {
    return {
      ok: false,
      httpStatus: 500,
      fbrResponse: {},
      errorCode: ErrorCodes.FBR_TOKEN_MISSING,
      errorMessage: 'FBR sandbox token is not configured.',
    };
  }

  const path = action === 'validate' ? VALIDATE_PATH : SUBMIT_PATH;

  try {
    const response = await getClient().post(path, invoice, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const isSuccess = response.status >= 200 && response.status < 300;

    if (isSuccess) {
      return {
        ok: true,
        httpStatus: response.status,
        fbrResponse: response.data,
      };
    }

    return {
      ok: false,
      httpStatus: response.status,
      fbrResponse: response.data,
      errorCode:
        action === 'validate'
          ? ErrorCodes.FBR_VALIDATION_REJECTED
          : ErrorCodes.FBR_SUBMISSION_REJECTED,
      errorMessage: 'FBR rejected the invoice.',
    };
  } catch (error) {
    return mapAxiosError(error);
  }
}

function mapAxiosError(error: unknown): FbrCallResult {
  if (error instanceof AxiosError) {
    // Timeout (may or may not have reached FBR). Never auto-retry submissions.
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        ok: false,
        httpStatus: 504,
        fbrResponse: {},
        errorCode: ErrorCodes.FBR_TIMEOUT,
        errorMessage: 'The request to FBR timed out.',
      };
    }

    // No response received: connection failed before/without a reply.
    if (!error.response) {
      return {
        ok: false,
        httpStatus: 502,
        fbrResponse: {},
        errorCode: ErrorCodes.FBR_NETWORK_ERROR,
        errorMessage: 'A network error occurred while contacting FBR.',
      };
    }

    return {
      ok: false,
      httpStatus: error.response.status,
      fbrResponse: error.response.data ?? {},
      errorCode: ErrorCodes.FBR_UNEXPECTED_RESPONSE,
      errorMessage: 'FBR returned an unexpected response.',
    };
  }

  return {
    ok: false,
    httpStatus: 500,
    fbrResponse: {},
    errorCode: ErrorCodes.FBR_UNEXPECTED_RESPONSE,
    errorMessage: 'An unexpected error occurred while contacting FBR.',
  };
}

export function validateInvoice(invoice: FbrInvoice, overrideToken?: string): Promise<FbrCallResult> {
  return callFbr('validate', invoice, overrideToken);
}

export function submitInvoice(invoice: FbrInvoice, overrideToken?: string): Promise<FbrCallResult> {
  return callFbr('submit', invoice, overrideToken);
}

/**
 * Test-only hook to reset the memoized client between test cases.
 */
export function __resetFbrClientForTests(): void {
  cachedClient = null;
}
