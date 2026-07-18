import { describe, expect, it } from 'vitest';
import { parseHdfcAlertEmail } from './alert-parser';

describe('parseHdfcAlertEmail', () => {
  it('parses a UPI debit alert', () => {
    const body = `Dear Customer,

Greetings from HDFC Bank!

Rs.219.00 is debited from your account ending 5749 towards VPA
0790682a0287499.bqr@kotak (SAILEE HOSPITAL CHEMIST) on 14-07-26.

UPI transaction reference no.: 619573702332.

If you did not authorize this transaction, please report it immediately at:`;

    expect(parseHdfcAlertEmail(body)).toEqual({
      txnDate: '2026-07-14',
      amount: 219.0,
      direction: 'debit',
      last4: '5749',
      descriptionRaw: 'UPI - SAILEE HOSPITAL CHEMIST',
      referenceNo: '619573702332',
    });
  });

  it('parses a credit card debit alert', () => {
    const body = `Dear Customer,

Greetings from HDFC Bank.

We would like to inform you that Rs. 490.00 has been debited from your
HDFC Bank Credit Card ending 2834 towards INDIGO AIRLINE on 11 Jul,
2026 at 19:39:30.

To check your available balance, outstanding amount, or view recent
transactions, you may use:`;

    expect(parseHdfcAlertEmail(body)).toEqual({
      txnDate: '2026-07-11',
      amount: 490.0,
      direction: 'debit',
      last4: '2834',
      descriptionRaw: 'Card - INDIGO AIRLINE',
      referenceNo: undefined,
    });
  });

  it('ignores a balance-update alert (not a transaction)', () => {
    const body = `Dear Customer,

Greetings from HDFC Bank!

The available balance in your account ending XX5749 is Rs. INR 5,16,779.38
as of 12-JUL-26.

The balance in the account does not include the uncleared cheque amount, if
any.`;

    expect(parseHdfcAlertEmail(body)).toBeNull();
  });

  it('ignores a standing-instruction bill-scheduled notice (not a completed transaction)', () => {
    const body = `Dear Customer,

Your new bill has been scheduled for automatic payment as
per your Standing Instruction for the following biller

Biller Name: Airtel Postpaid Fetch and Pay
SmartPay: Y
Bank Account/Card Number: 2834
Scheduled Date: 17-Jul-2026
Bill Due Date: 22-Jul-2026
Transaction ID: HGALP0BBDE1000544791
Payment Amount: 941.64`;

    expect(parseHdfcAlertEmail(body)).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseHdfcAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });

  it('parses an old-template UPI debit alert (pre-migration sender)', () => {
    const body = `Dear Customer,
Rs.215.00 has been debited from account 5749 to VPA paytmqr1w4o9n2m1y@paytm HITESH MEDICO on 01-11-25.
Your UPI transaction reference number is 530531444248.
If you did not authorize this transaction, please report it immediately by calling 18002586161 Or SMS BLOCK UPI to 7308080808.
Warm Regards,
HDFC Bank`;

    expect(parseHdfcAlertEmail(body)).toEqual({
      txnDate: '2025-11-01',
      amount: 215.0,
      direction: 'debit',
      last4: '5749',
      descriptionRaw: 'UPI - HITESH MEDICO',
      referenceNo: '530531444248',
    });
  });

  it('parses an old-template credit card debit alert (pre-migration sender)', () => {
    const body = `Dear Customer,

Greetings from HDFC Bank!

Rs.2297.03 is debited from your HDFC Bank Credit Card ending 2834 towards OM NAMAH PETROLEUM PR4 on 06 Nov, 2025 at 12:33:39.

To know your available balance, outstanding amount and transactions in detail, please visit MyCards.`;

    expect(parseHdfcAlertEmail(body)).toEqual({
      txnDate: '2025-11-06',
      amount: 2297.03,
      direction: 'debit',
      last4: '2834',
      descriptionRaw: 'Card - OM NAMAH PETROLEUM PR4',
      referenceNo: undefined,
    });
  });

  it('ignores a FASTag toll payment (not tied to a bank account, unsupported for now)', () => {
    const body = `Dear Customer,
We want to notify you that Rs.80 has been deducted from your FASTag Wallet 190000106xxxxx.
Please find the transaction details below:
- Transaction date:2026-04-18 16:37:47
- Plaza:Khalapur Toll Plaza
- Vehicle number:MH47ABxxxx
- Available Wallet Balance: Rs.1108.50`;

    expect(parseHdfcAlertEmail(body)).toBeNull();
  });

  it('handles amounts with thousands separators', () => {
    const body = `Rs.1,50,000.00 is debited from your account ending 5749 towards VPA
someone@bank (BIG PURCHASE STORE) on 01-01-26.

UPI transaction reference no.: 123456789012.`;

    const result = parseHdfcAlertEmail(body);
    expect(result?.amount).toBe(150000);
  });
});
