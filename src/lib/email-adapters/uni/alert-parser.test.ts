import { describe, expect, it } from 'vitest';
import { parseUniAlertEmail } from './alert-parser';

describe('parseUniAlertEmail', () => {
  it('parses a "you paid" transaction alert', () => {
    const body = `1/3 RD TRANSACTION
₹ 2,500
Paid to IOCL
Transaction ID Td6ee8ee7ab294168ac6bb2d6e5e3bdd5
Transaction on 13 Aug 2022 07:54 AM
This transaction will be billed in 3 parts
over 3 months from your next billing date
26 Aug 2022
Go to App`;

    expect(parseUniAlertEmail(body)).toEqual({
      txnDate: '2022-08-13',
      amount: 2500,
      direction: 'debit',
      last4: '0001',
      descriptionRaw: 'Card - IOCL',
      referenceNo: 'Td6ee8ee7ab294168ac6bb2d6e5e3bdd5',
    });
  });

  it('handles a stray divider between the merchant name and Transaction ID', () => {
    const body = `₹2,500
Paid to
IOCL
_____
Transaction ID
Td6ee8ee7ab294168ac6bb2d6e5e3bdd5
Transaction on
13 Aug 2022 07:54 AM`;

    const result = parseUniAlertEmail(body);
    expect(result?.descriptionRaw).toBe('Card - IOCL');
  });

  it('ignores a bill-due notification (not a per-transaction alert)', () => {
    const body = `Hi Girish,
Your bill is due today.
Billed Amount
₹ 18,185.84
Due Date
05/09/2022
Minimum payment
₹ 2,474.32`;

    expect(parseUniAlertEmail(body)).toBeNull();
  });

  it('ignores a credit-limit-change notice', () => {
    const body = `Hi Girish Tare
We're excited to announce that we recently increased your credit limit to Rs. 295000 from Rs. 50000.`;

    expect(parseUniAlertEmail(body)).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseUniAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });
});
