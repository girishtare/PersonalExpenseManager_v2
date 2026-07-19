import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { Card } from '@/components/ui/card';
import {
  findStatementTotalMismatches,
  reconcileCcBillPayments,
  type BillPayment,
  type CardStatement,
  type StatementActivity,
} from '@/lib/reconciliation/match';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

export default async function ReconciliationPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const { data: billPaymentCategories } = await supabase
    .from('categories')
    .select('id')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .ilike('name', 'CC Bill Payment');
  const categoryIds = (billPaymentCategories ?? []).map((c) => c.id);

  const [{ data: paymentRows }, { data: statementRows }] = await Promise.all([
    categoryIds.length
      ? supabase
          .from('transactions')
          .select('id, txn_date, amount, description_raw')
          .eq('user_id', user.id)
          .in('category_id', categoryIds)
          .order('txn_date', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('statements')
      .select(
        'id, file_name, statement_period_start, statement_period_end, total_amount_due, opening_balance, accounts!inner(account_type)'
      )
      .eq('user_id', user.id)
      .eq('accounts.account_type', 'credit_card')
      .in('parse_status', ['parsed', 'partially_parsed'])
      .order('statement_period_end', { ascending: false }),
  ]);

  const payments: BillPayment[] = (paymentRows ?? []).map((p) => ({
    id: p.id,
    txn_date: p.txn_date,
    amount: Number(p.amount),
    description_raw: p.description_raw,
  }));

  const statements: CardStatement[] = (statementRows ?? []).map((s) => ({
    id: s.id,
    file_name: s.file_name,
    statement_period_start: s.statement_period_start,
    statement_period_end: s.statement_period_end,
    total_amount_due: s.total_amount_due !== null ? Number(s.total_amount_due) : null,
  }));

  const result = reconcileCcBillPayments(payments, statements);

  const statementIds = (statementRows ?? []).map((s) => s.id);
  // Paged - the per-statement sums silently lose rows past PostgREST's 1000-row cap otherwise,
  // which would show up here as false "statement total discrepancy" flags.
  const statementTxns = statementIds.length
    ? await fetchAllRows(() => supabase.from('transactions').select('statement_id, amount, direction').in('statement_id', statementIds))
    : [];

  const sumsByStatement = new Map<string, number>();
  for (const t of statementTxns) {
    const signed = t.direction === 'debit' ? Number(t.amount) : -Number(t.amount);
    sumsByStatement.set(t.statement_id, (sumsByStatement.get(t.statement_id) ?? 0) + signed);
  }

  const activity: StatementActivity[] = (statementRows ?? []).map((s) => ({
    id: s.id,
    file_name: s.file_name,
    total_amount_due: s.total_amount_due !== null ? Number(s.total_amount_due) : null,
    opening_balance: s.opening_balance !== null ? Number(s.opening_balance) : null,
    sumOfTransactions: sumsByStatement.get(s.id) ?? 0,
  }));

  const totalCheck = findStatementTotalMismatches(activity);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">CC Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Matches bank-side &quot;CC Bill Payment&quot; transactions against credit card statement totals, and flags
          statements whose parsed transactions don&apos;t add up to their own printed total.
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Matched pairs ({result.matched.length})</h2>
        {result.matched.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Payment date</th>
                  <th className="pb-2 font-medium">Amount paid</th>
                  <th className="pb-2 font-medium">Statement</th>
                  <th className="pb-2 font-medium">Statement period</th>
                  <th className="pb-2 text-right font-medium">Total due</th>
                  <th className="pb-2 text-right font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {result.matched.map(({ payment, statement, amountDiff }) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="py-2">{payment.txn_date}</td>
                    <td className="py-2 tabular-nums">{formatCurrency(payment.amount)}</td>
                    <td className="py-2">{statement.file_name}</td>
                    <td className="py-2">
                      {statement.statement_period_start ?? '?'} &ndash; {statement.statement_period_end}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatCurrency(statement.total_amount_due!)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(amountDiff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No matches yet.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">Unmatched bill payments ({result.unmatchedPayments.length})</h2>
          <p className="text-xs text-muted-foreground">
            No card statement was found within &#8377;1 of the payment amount, dated before the payment.
          </p>
          {result.unmatchedPayments.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {result.unmatchedPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between border-t border-border pt-2">
                  <span>{p.txn_date}</span>
                  <span className="tabular-nums">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">Unmatched card statements ({result.unmatchedStatements.length})</h2>
          <p className="text-xs text-muted-foreground">These statements have a total due, but no bill payment claimed them.</p>
          {result.unmatchedStatements.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {result.unmatchedStatements.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-t border-border pt-2">
                  <span>{s.file_name}</span>
                  <span className="tabular-nums">{formatCurrency(s.total_amount_due!)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Statement total discrepancies ({totalCheck.flagged.length})</h2>
        <p className="text-xs text-muted-foreground">
          Opening balance + sum of this statement&apos;s parsed transactions vs. its own printed total amount due, off by
          more than &#8377;1 - a sign the parser may have missed or misparsed a line item.
        </p>
        {totalCheck.flagged.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {totalCheck.flagged.map(({ statement, expected, actual, diff }) => (
              <li key={statement.id} className="flex flex-col gap-1 border-t border-border pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{statement.file_name}</span>
                <span className="tabular-nums text-destructive">
                  expected {formatCurrency(expected)}, parsed {formatCurrency(actual)} (diff {formatCurrency(diff)})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No discrepancies found.</p>
        )}
      </Card>

      {(result.unverifiableStatements.length > 0 || totalCheck.notVerifiable.length > 0) && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">Not verifiable</h2>
          <p className="text-xs text-muted-foreground">
            Statements the parser couldn&apos;t capture a total for (older imports, or a format it couldn&apos;t extract
            from) - re-upload to try again once the parser supports it.
          </p>
          {result.unverifiableStatements.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Missing total due or period end (can&apos;t match to a payment):</p>
              <ul className="flex flex-col gap-1 text-sm">
                {result.unverifiableStatements.map((s) => (
                  <li key={s.id}>{s.file_name}</li>
                ))}
              </ul>
            </div>
          )}
          {totalCheck.notVerifiable.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Missing total due or opening balance (can&apos;t check for discrepancies):</p>
              <ul className="flex flex-col gap-1 text-sm">
                {totalCheck.notVerifiable.map((s) => (
                  <li key={s.id}>{s.file_name}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
