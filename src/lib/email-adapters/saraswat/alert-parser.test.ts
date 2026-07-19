import { describe, expect, it } from 'vitest';
import { parseSaraswatAlertEmail } from './alert-parser';

describe('parseSaraswatAlertEmail', () => {
  it('parses a Credit Transaction alert', () => {
    const body = `Dear Customer,
Below is a summary of Credit Transaction:
Date, Time : 30-06-2026 04:39:02
Credit Account No: XX1687
Amount: INR 1,000.00
Particulars: - NEFT/HDFCN52026070165489372/GI
We advise that you keep this email as a reference of your transaction.
Please note: Do not respond to this email as this email address is used for sending Saraswat Bank emails only.`;

    expect(parseSaraswatAlertEmail(body)).toEqual({
      txnDate: '2026-06-30',
      amount: 1000.0,
      direction: 'credit',
      last4: '1687',
      descriptionRaw: 'NEFT/HDFCN52026070165489372/GI',
      referenceNo: undefined,
    });
  });

  it('parses a generic Debit Transaction alert (e.g. card AMC fee)', () => {
    const body = `Dear Customer,
Below is a summary of Debit Transaction:
Date, Time : 19-09-2025 16:22:03
Debit Account No: XX1687
Amount: INR 236.00
Particulars: - CARD AMC SEP25 XX1633
We advise that you keep this email as a reference of your transaction.`;

    expect(parseSaraswatAlertEmail(body)).toEqual({
      txnDate: '2025-09-19',
      amount: 236.0,
      direction: 'debit',
      last4: '1687',
      descriptionRaw: 'CARD AMC SEP25 XX1633',
      referenceNo: undefined,
    });
  });

  it('parses an NEFT/RTGS debit alert (separate wording, with a Ref no field)', () => {
    const body = `Dear Customer,
Below is the summary of NEFT/RTGS debit transaction from your account:
Date, Time: 02-03-2025 10:29:54
Debit Account no: XX1687
Amount: INR 3,52,000.00
Ref no: SRCB025061990879
Particulars: NEFT-SURESH TA-027200100024861-SRCB0000027
You will get message after successfully transmission of RTGS/NEFT.
We advise that you keep this email as a reference of your transaction.`;

    expect(parseSaraswatAlertEmail(body)).toEqual({
      txnDate: '2025-03-02',
      amount: 352000.0,
      direction: 'debit',
      last4: '1687',
      descriptionRaw: 'NEFT-SURESH TA-027200100024861-SRCB0000027',
      referenceNo: 'SRCB025061990879',
    });
  });

  it('ignores unrelated text', () => {
    expect(parseSaraswatAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });

  it('ignores a KYC/form-submission reminder (not a transaction)', () => {
    const body = `Dear Customer,
Request you to submit "New Form-121" (earlier Form 15G/15H) duly filled and signed latest by 22nd April 2026.`;

    expect(parseSaraswatAlertEmail(body)).toBeNull();
  });
});
