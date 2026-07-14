import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { __clearIdempotencyCache } from '../src/utils/idempotency.js';
import { validInvoice } from './fixtures.js';

const app = createApp();
const AUTH = 'Bearer test-bridge-api-key';

beforeEach(() => {
  __clearIdempotencyCache();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'fbr-bridge' });
  });
});

describe('bridge auth', () => {
  it('rejects requests without the bridge API key', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/submit')
      .send({ invoice: validInvoice() });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED_BRIDGE_REQUEST');
  });

  it('rejects an incorrect bridge API key', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/submit')
      .set('Authorization', 'Bearer wrong-key')
      .send({ invoice: validInvoice() });
    expect(res.status).toBe(401);
  });
});

describe('validation endpoint (mock mode)', () => {
  it('forwards a valid invoice and returns a success envelope', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/validate')
      .set('Authorization', AUTH)
      .send({ submissionId: 'sub-1', invoice: validInvoice() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      mock: true,
      action: 'validate',
      submissionId: 'sub-1',
      environment: 'sandbox',
    });
    expect(res.body.fbrResponse).toBeDefined();
  });

  it('rejects a missing required field', async () => {
    const invoice = validInvoice() as Record<string, unknown>;
    delete invoice.sellerBusinessName;
    const res = await request(app)
      .post('/api/v1/fbr/invoices/validate')
      .set('Authorization', AUTH)
      .send({ invoice });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.validationErrors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid date format', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/validate')
      .set('Authorization', AUTH)
      .send({ invoice: { ...validInvoice(), invoiceDate: '14/07/2026' } });
    expect(res.status).toBe(400);
  });

  it('rejects an empty items array', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/validate')
      .set('Authorization', AUTH)
      .send({ invoice: { ...validInvoice(), items: [] } });
    expect(res.status).toBe(400);
  });
});

describe('submission endpoint (mock mode)', () => {
  it('returns a success envelope for a valid invoice', async () => {
    const res = await request(app)
      .post('/api/v1/fbr/invoices/submit')
      .set('Authorization', AUTH)
      .send({ submissionId: 'sub-2', invoice: validInvoice() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, action: 'submit', mock: true });
  });

  it('replays the same response for a repeated idempotency key', async () => {
    const key = 'idem-123';
    const first = await request(app)
      .post('/api/v1/fbr/invoices/submit')
      .set('Authorization', AUTH)
      .set('X-Idempotency-Key', key)
      .send({ submissionId: 'sub-3', invoice: validInvoice() });

    const second = await request(app)
      .post('/api/v1/fbr/invoices/submit')
      .set('Authorization', AUTH)
      .set('X-Idempotency-Key', key)
      .send({ submissionId: 'sub-3', invoice: validInvoice() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.requestId).toBe(first.body.requestId);
  });
});
