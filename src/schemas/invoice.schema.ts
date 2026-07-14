import { z } from 'zod';

/**
 * Numeric field that must be finite and non-negative.
 */
const nonNegativeNumber = z
  .number({ invalid_type_error: 'Expected a number' })
  .finite('Value must be finite')
  .nonnegative('Value must not be negative');

/**
 * Text field that must be a non-empty string after trimming.
 */
const requiredText = z.string().trim().min(1, 'Required text field must not be empty');

/**
 * Identifier fields (NTN/CNIC) must remain strings and must not be silently
 * coerced from numbers. We intentionally do NOT use z.coerce here.
 */
const identifierString = z
  .string({ invalid_type_error: 'Identifier must be a string, not a number' })
  .trim()
  .min(1, 'Identifier must not be empty');

const invoiceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must use the format YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'invoiceDate is not a valid calendar date');

export const fbrInvoiceItemSchema = z
  .object({
    hsCode: requiredText,
    productDescription: requiredText,
    rate: requiredText,
    uoM: requiredText,
    // For a real test submission quantity must be greater than zero.
    quantity: nonNegativeNumber.gt(0, 'quantity must be greater than zero'),
    totalValues: nonNegativeNumber,
    valueSalesExcludingST: nonNegativeNumber,
    fixedNotifiedValueOrRetailPrice: nonNegativeNumber,
    salesTaxApplicable: nonNegativeNumber,
    salesTaxWithheldAtSource: nonNegativeNumber,
    // Optional-ish text fields: string but may be empty per FBR sample payload.
    extraTax: z.string(),
    furtherTax: nonNegativeNumber,
    sroScheduleNo: z.string(),
    fedPayable: nonNegativeNumber,
    discount: nonNegativeNumber,
    saleType: z.string(),
    sroItemSerialNo: z.string(),
  })
  .strict();

export const fbrInvoiceSchema = z
  .object({
    invoiceType: requiredText,
    invoiceDate,
    sellerNTNCNIC: identifierString,
    sellerBusinessName: requiredText,
    sellerProvince: requiredText,
    sellerAddress: requiredText,
    buyerNTNCNIC: identifierString,
    buyerBusinessName: requiredText,
    buyerProvince: requiredText,
    buyerAddress: requiredText,
    buyerRegistrationType: requiredText,
    // invoiceRefNo and scenarioId must remain strings; they may be empty.
    invoiceRefNo: z.string(),
    scenarioId: z.string(),
    items: z.array(fbrInvoiceItemSchema).min(1, 'items must contain at least one item'),
  })
  .strict();

/**
 * Optional wrapper. Unknown top-level fields are stripped (not forwarded).
 */
export const bridgeRequestSchema = z
  .object({
    submissionId: z.string().trim().min(1).optional(),
    invoice: fbrInvoiceSchema,
  })
  .strict();

export type FbrInvoiceInput = z.infer<typeof fbrInvoiceSchema>;
export type BridgeRequestInput = z.infer<typeof bridgeRequestSchema>;
