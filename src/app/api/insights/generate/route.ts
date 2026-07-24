import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { isAllowedEmail } from '@/lib/auth/allowlist';
import { toDateKey } from '@/lib/dashboard/period';
import { computeAdvisoryInputs, type AdvisoryTxn } from '@/lib/advisory/aggregate';
import { generateAdvisory } from '@/lib/advisory/generate';

export const maxDuration = 60;

/**
 * Daily cron job (see vercel.json) that regenerates the dashboard's financial advisory: pulls
 * the last 12 months of transactions, summarizes them, asks Gemini (Google AI Studio's free
 * tier - see generateAdvisory) for investment/spending suggestions grounded in those real
 * numbers, and upserts the single row the dashboard reads.
 * Vercel signs cron-triggered requests with `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set as a project env var - same shared-secret pattern /api/gmail/sync uses for its own
 * server-to-server calls, just a different secret since this one is Vercel's own convention.
 */
export async function GET(request: Request) {
  const isAuthorized = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }
  const owner = usersData.users.find((u) => isAllowedEmail(u.email));
  if (!owner) {
    return NextResponse.json({ error: 'Owner user not found.' }, { status: 500 });
  }

  const today = new Date();
  const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const rows = await fetchAllRows(() =>
    supabase
      .from('transactions')
      .select('amount, txn_type_override, categories(name, txn_type)')
      .eq('user_id', owner.id)
      .gte('txn_date', toDateKey(twelveMonthsAgo))
  );

  const inputs = computeAdvisoryInputs(rows as AdvisoryTxn[]);

  let advisory;
  try {
    advisory = await generateAdvisory(inputs);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Advisory generation failed.' }, { status: 500 });
  }

  const { error: upsertError } = await supabase.from('financial_advisory').upsert(
    {
      user_id: owner.id,
      generated_at: new Date().toISOString(),
      model: advisory.model,
      investment_tips: advisory.investmentTips,
      spending_tips: advisory.spendingTips,
    },
    { onConflict: 'user_id' }
  );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, investmentTips: advisory.investmentTips.length, spendingTips: advisory.spendingTips.length });
}
