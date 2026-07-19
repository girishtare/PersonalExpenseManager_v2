import { describe, expect, it } from 'vitest';
import { parseSbmAlertEmail } from './alert-parser';

describe('parseSbmAlertEmail', () => {
  it('parses a Credit Transaction Alert', () => {
    const body = `Dear GIRISH TARE,
Greetings from SBM Bank India!
Your account XX2750 is credited with INR 2.00 on 01-07-2026. Info:20051021492750:Int.Pd:01-06-20. The Curr bal is 796.00.
Looking forward to more opportunities to serve you.
Sincerely,
SBM Bank (India) Ltd.`;

    expect(parseSbmAlertEmail(body)).toEqual({
      txnDate: '2026-07-01',
      amount: 2.0,
      direction: 'credit',
      last4: '2750',
      descriptionRaw: '20051021492750:Int.Pd:01-06-20',
    });
  });

  it('parses a debit alert (subject "SBM Bank", not a dedicated debit subject)', () => {
    const body = `Dear GIRISH TARE,
Greetings from SBM Bank India!
Your account XX2750 is debited with INR 1076.00 on 05-12-2022. Info:PG_20051021492750_T4082777_IND. The Curr bal is 41.00.
If the transaction has not been initiated at your end, please call 18001033817.
We thank you for the trust reposed in us.`;

    expect(parseSbmAlertEmail(body)).toEqual({
      txnDate: '2022-12-05',
      amount: 1076.0,
      direction: 'debit',
      last4: '2750',
      descriptionRaw: 'PG_20051021492750_T4082777_IND',
    });
  });

  it('ignores an e-statement notification', () => {
    expect(parseSbmAlertEmail('Your SBM Bank e-Statement for the period 1 May 2026 to 31 May 2026 is attached.')).toBeNull();
  });

  it('ignores a downtime/marketing notice', () => {
    expect(parseSbmAlertEmail('This is a scheduled downtime notification for SBM Bank India internet banking.')).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseSbmAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });
});
