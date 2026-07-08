import { describe, expect, it } from 'vitest';
import { buildCreditCardStatementFromRows, extractCreditCardStatementTotals } from './tabular';

describe('buildCreditCardStatementFromRows - refund/credit direction mapping', () => {
  const header = ['Transaction type', '', '', '', 'Primary / Addon Customer Name', '', '', '', '', 'Date & Time', '', '', 'Description', '', '', '', '', '', 'REWARDS', '', 'AMT', '', '', 'Debit / Credit', ''];

  it('a "Cr"-marked row is ingested as direction credit, not income - it is a category concern, not a direction one', () => {
    const rows = [
      header,
      ['Domestic', '', '', '', 'GIRISH S TARE', '', '', '', '', '07/01/2026 / 00:00', '', '', 'PETRO SURCHARGE WAIVER', '', '', '', '', '', '', '', '52.92', '', '', 'Cr', ''],
    ];
    const result = buildCreditCardStatementFromRows(rows);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].direction).toBe('credit');
    expect(result.transactions[0].amount).toBe(52.92);
    // The parser only ever produces raw transactions (date/amount/direction/description) - it
    // has no concept of category or income/expense. Whether this credit lands in an income-type
    // or expense-type category is entirely a categorization_rules concern (see
    // supabase/migrations/20260708150000_cc_reconciliation.sql's "Card Refunds & Waivers" rule).
    expect(result.transactions[0]).not.toHaveProperty('category');
    expect(result.transactions[0]).not.toHaveProperty('txn_type');
  });

  it('a row with no Cr/Dr marker defaults to debit (an ordinary purchase)', () => {
    const rows = [
      header,
      ['Domestic', '', '', '', 'GIRISH S TARE', '', '', '', '', '20/12/2025 / 12:49', '', '', 'AMAZON PAY INDIA PVT L', '', '', '', '', '', '', '', '671.38', '', '', '', ''],
    ];
    const result = buildCreditCardStatementFromRows(rows);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].direction).toBe('debit');
  });
});

describe('extractCreditCardStatementTotals', () => {
  it('extracts Total Amount Due and Opening Bal from the real statement layout', () => {
    const rows = [
      ['Total Amount Due', '', '', '', '2,01,756.00', '', '', '', '', '', 'Past Dues (If any)'],
      ['Opening Bal', '', '', '', '-', 'Payment / Credit', '', '', '', '+', 'Purchases / Debits'],
      ['1,34,738.88', '', '', '', '', '40,162.02', '', '', '', '', '1,02,487.99'],
    ];
    const result = extractCreditCardStatementTotals(rows);
    expect(result.totalAmountDue).toBe(201756);
    expect(result.openingBalance).toBe(134738.88);
  });

  it('returns undefined for both when the labels are not present', () => {
    const rows = [['Date', 'Description', 'Amount'], ['01/01/2026', 'SOMETHING', '100.00']];
    const result = extractCreditCardStatementTotals(rows);
    expect(result.totalAmountDue).toBeUndefined();
    expect(result.openingBalance).toBeUndefined();
  });
});
