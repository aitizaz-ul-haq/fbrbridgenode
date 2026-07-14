import { describe, expect, it } from 'vitest';
import { fbrInvoiceSchema } from '../src/schemas/invoice.schema.js';
import { validInvoice } from './fixtures.js';

describe('fbrInvoiceSchema', () => {
  it('accepts a valid invoice', () => {
    const result = fbrInvoiceSchema.safeParse(validInvoice());
    expect(result.success).toBe(true);
  });

  it('rejects a missing required field', () => {
    const invoice = validInvoice() as Record<string, unknown>;
    delete invoice.sellerBusinessName;
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid date format', () => {
    const invoice = { ...validInvoice(), invoiceDate: '14-07-2026' };
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('rejects an empty items array', () => {
    const invoice = { ...validInvoice(), items: [] };
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('rejects quantity of zero', () => {
    const invoice = validInvoice();
    invoice.items[0].quantity = 0;
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('does not silently coerce a numeric NTN/CNIC to a string', () => {
    const invoice = { ...validInvoice(), sellerNTNCNIC: 1234567890123 };
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level fields', () => {
    const invoice = { ...validInvoice(), unexpectedField: 'nope' };
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });

  it('rejects a negative numeric field', () => {
    const invoice = validInvoice();
    invoice.items[0].totalValues = -1;
    const result = fbrInvoiceSchema.safeParse(invoice);
    expect(result.success).toBe(false);
  });
});
