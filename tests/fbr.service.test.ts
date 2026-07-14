import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force non-mock mode with a token for this file so the real call path runs.
vi.mock('../src/config/env.js', () => ({
  env: {
    nodeEnv: 'test',
    isProduction: false,
    port: 3999,
    host: '127.0.0.1',
    fbrBaseUrl: 'https://gw.fbr.gov.pk/di_data/v1/di',
    fbrSandboxToken: 'test-token',
    bridgeApiKey: 'test-bridge-api-key',
    allowedOrigins: ['https://app.example'],
    requestTimeoutMs: 5000,
    logLevel: 'silent',
    mockMode: false,
    environmentLabel: 'sandbox',
  },
}));

const post = vi.fn();
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: () => ({ post }),
    },
  };
});

import {
  __resetFbrClientForTests,
  submitInvoice,
  validateInvoice,
} from '../src/services/fbr.service.js';
import { validInvoice } from './fixtures.js';

beforeEach(() => {
  __resetFbrClientForTests();
  post.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('fbr.service (real call path, axios mocked)', () => {
  it('forwards a successful FBR validation response', async () => {
    post.mockResolvedValue({ status: 200, data: { message: 'ok', reference: 'REF-1' } });
    const result = await validateInvoice(validInvoice());
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.fbrResponse).toMatchObject({ reference: 'REF-1' });
  });

  it('preserves an FBR rejection body and maps validation rejection code', async () => {
    post.mockResolvedValue({ status: 400, data: { error: 'bad invoice' } });
    const result = await validateInvoice(validInvoice());
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(400);
    expect(result.errorCode).toBe('FBR_VALIDATION_REJECTED');
    expect(result.fbrResponse).toMatchObject({ error: 'bad invoice' });
  });

  it('preserves an FBR submission rejection code', async () => {
    post.mockResolvedValue({ status: 422, data: { error: 'rejected' } });
    const result = await submitInvoice(validInvoice());
    expect(result.errorCode).toBe('FBR_SUBMISSION_REJECTED');
  });

  it('maps a timeout to FBR_TIMEOUT', async () => {
    post.mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'));
    const result = await submitInvoice(validInvoice());
    expect(result.errorCode).toBe('FBR_TIMEOUT');
    expect(result.httpStatus).toBe(504);
  });

  it('maps a connection failure (no response) to FBR_NETWORK_ERROR', async () => {
    post.mockRejectedValue(new AxiosError('connection refused', 'ECONNREFUSED'));
    const result = await submitInvoice(validInvoice());
    expect(result.errorCode).toBe('FBR_NETWORK_ERROR');
    expect(result.httpStatus).toBe(502);
  });
});
