import { describe, expect, it } from 'vitest';
import { parseBobcardAlertEmail } from './alert-parser';

describe('parseBobcardAlertEmail', () => {
  it('parses a card-usage payment alert', () => {
    const body = `Hi,

Your BOBCARD One Credit Card ending in 7790 was used to make a payment.

Amount: INR 337.48

Merchant: WIX.COM 1238707349

Date: 23/05/2026

Time: 07:24:09

If you didn't initiate this payment, please report it immediately.`;

    expect(parseBobcardAlertEmail(body)).toEqual({
      txnDate: '2026-05-23',
      amount: 337.48,
      direction: 'debit',
      last4: '7790',
      descriptionRaw: 'Card - WIX.COM 1238707349',
      referenceNo: undefined,
    });
  });

  it('ignores a foreign-currency (non-INR) transaction rather than misreport the amount', () => {
    const body = `Hi,

Your BOBCARD One Credit Card ending in 7790 was used to make a payment.

Amount: USD 23.60

Merchant: ANTHROPIC* CLAUDE SUB

Date: 20/06/2026

Time: 21:53:39`;

    expect(parseBobcardAlertEmail(body)).toBeNull();
  });

  it('ignores a statement notification', () => {
    expect(parseBobcardAlertEmail('BOBCARD One Credit Card statement for July 2026 is now available.')).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseBobcardAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });
});
