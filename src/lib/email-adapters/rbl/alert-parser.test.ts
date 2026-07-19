import { describe, expect, it } from 'vitest';
import { parseRblAlertEmail } from './alert-parser';

describe('parseRblAlertEmail', () => {
  it('parses a card-swipe alert', () => {
    const body = `Card swipe
INR337.48 spent at WIX.COM 1233488769 on RBL Bank credit card (1618) on 12-04-2026.AVL limit- INR753,693.16. Not you? Call 022-62327777
Questions?
Reach out: 022 6232 7777`;

    expect(parseRblAlertEmail(body)).toEqual({
      txnDate: '2026-04-12',
      amount: 337.48,
      direction: 'debit',
      last4: '1618',
      descriptionRaw: 'Card - WIX.COM 1233488769',
      referenceNo: undefined,
    });
  });

  it('ignores a "payment received" (bill payment) alert', () => {
    const body = `RBL Bank-Credit Card
Payment received towards your Credit Card
Dear GIRISH S TARE,
A payment of Rs.4292.00 has been received towards your RBL Bank Credit Card ending with 18 on 01-07-2026 through Bill Desk.`;

    expect(parseRblAlertEmail(body)).toBeNull();
  });

  it('ignores an OTP notice', () => {
    expect(parseRblAlertEmail('One-Time Password for your online transaction is 123456.')).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseRblAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });
});
