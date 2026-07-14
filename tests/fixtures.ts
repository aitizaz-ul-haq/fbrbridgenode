import type { FbrInvoice } from '../src/types/invoice.js';

/**
 * A valid invoice matching the schema and the FBR sample payload.
 */
export function validInvoice(): FbrInvoice {
  return {
    invoiceType: 'Sale Invoice',
    invoiceDate: '2026-07-14',
    sellerNTNCNIC: '0000000000000',
    sellerBusinessName: 'Your Business Name',
    sellerProvince: 'Sindh',
    sellerAddress: 'Seller Address',
    buyerNTNCNIC: '1111111111111',
    buyerBusinessName: 'Buyer Business Name',
    buyerProvince: 'Punjab',
    buyerAddress: 'Buyer Address',
    buyerRegistrationType: 'Registered',
    invoiceRefNo: '',
    scenarioId: 'SN000',
    items: [
      {
        hsCode: '0000.0000',
        productDescription: 'Example product',
        rate: '0%',
        uoM: 'Numbers, pieces, units',
        quantity: 1,
        totalValues: 1000,
        valueSalesExcludingST: 1000,
        fixedNotifiedValueOrRetailPrice: 0,
        salesTaxApplicable: 0,
        salesTaxWithheldAtSource: 0,
        extraTax: '',
        furtherTax: 0,
        sroScheduleNo: '',
        fedPayable: 0,
        discount: 0,
        saleType: '',
        sroItemSerialNo: '',
      },
    ],
  };
}
