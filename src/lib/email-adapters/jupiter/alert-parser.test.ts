import { describe, expect, it } from 'vitest';
import { parseJupiterAlertEmail } from './alert-parser';

describe('parseJupiterAlertEmail', () => {
  it('parses a UPI payment-successful alert', () => {
    const body = `A quick update on your payment
Hey Girish, your
payment was successful 👏
Here's a summary for your reference
Paid to
Wikimedia
wikimedia824.rzp@icici
A
How much
₹29
When
Fri, Sep 01, 2023 10:18 AM
Paid by
Girish
9820962873@jupiteraxis
Transaction ID
543850071467083
Bank reference number
324451850116
Invite your friends to Jupiter and Earn up to 1000 Jewels!`;

    expect(parseJupiterAlertEmail(body)).toEqual({
      txnDate: '2023-09-01',
      amount: 29,
      direction: 'debit',
      last4: '2873',
      descriptionRaw: 'UPI - Wikimedia',
      referenceNo: '543850071467083',
    });
  });

  it('parses a payment to a person (not a merchant)', () => {
    const body = `A quick update on your payment
Hey Girish, your
payment was successful 👏
Paid to
Siddhi Sandesh Tawade
sandy.786ssaannddyy@okaxis
How much
₹20
When
Fri, Sep 01, 2023 07:33 AM
Paid by
Girish
9820962873@jupiteraxis
Transaction ID
318528551569549
Bank reference number
324447003114`;

    expect(parseJupiterAlertEmail(body)).toEqual({
      txnDate: '2023-09-01',
      amount: 20,
      direction: 'debit',
      last4: '2873',
      descriptionRaw: 'UPI - Siddhi Sandesh Tawade',
      referenceNo: '318528551569549',
    });
  });

  it('ignores promotional/marketing emails', () => {
    const body = `Congratulations! The annual maintenance fee of ₹235 on your Debit Card has been waived.
Why was your fee waived? You spent ₹25,000 or more on eligible merchants.`;

    expect(parseJupiterAlertEmail(body)).toBeNull();
  });

  it('ignores an interest-credit summary (not a per-transaction alert)', () => {
    const body = `View your quarterly interest credit ₹38 as Quarterly Interest is credited to your Federal Bank Account on Jupiter.
Hey, Girish! Loved how smooth this was?`;

    expect(parseJupiterAlertEmail(body)).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(parseJupiterAlertEmail('Hello, this is not a bank alert at all.')).toBeNull();
  });
});
