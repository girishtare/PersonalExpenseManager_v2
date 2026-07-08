import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { parseDateKey, projectMonthEnd, toDateKey } from '@/lib/dashboard/period';
import { BudgetCard, type BudgetRow } from './budget-card';

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthKeyOf(date: Date): string {
  return toDateKey(date).slice(0, 7);
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const params = await searchParams;

  const today = new Date();
  const todayMonthKey = monthKeyOf(today);
  const monthKey = params.month && MONTH_KEY_RE.test(params.month) && params.month <= todayMonthKey ? params.month : todayMonthKey;

  const viewedMonthStart = parseDateKey(`${monthKey}-01`);
  const isCurrentMonth = monthKey === todayMonthKey;
  // A past month is fully elapsed - "spent" covers the whole month and the projection
  // degenerates to the actual total. The current month is only spent-to-date.
  const viewedEnd = isCurrentMonth ? today : new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth() + 1, 0);

  const prevMonthKey = monthKeyOf(new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth() - 1, 1));
  const nextMonthDate = new Date(viewedMonthStart.getFullYear(), viewedMonthStart.getMonth() + 1, 1);
  const nextMonthKey = monthKeyOf(nextMonthDate);
  const canGoNext = nextMonthKey <= todayMonthKey;

  const [{ data: categoryRows }, { data: budgetRows }, { data: monthToDateRows }] = await Promise.all([
    supabase.from('categories').select('id, name, txn_type').or(`user_id.eq.${user.id},user_id.is.null`).order('name', { ascending: true }),
    supabase.from('budgets').select('category_id, monthly_amount, effective_from').eq('user_id', user.id),
    supabase
      .from('transactions')
      .select('amount, direction, category_id')
      .eq('user_id', user.id)
      .gte('txn_date', toDateKey(viewedMonthStart))
      .lte('txn_date', toDateKey(viewedEnd)),
  ]);

  // Resolve the latest budget row per category as of the viewed month (a budget can change over
  // time via effective_from - later rows override earlier ones, but never one dated after the
  // month being viewed).
  const endKey = toDateKey(viewedEnd);
  const currentBudgetByCategory = new Map<string, { amount: number; effectiveFrom: string }>();
  for (const b of budgetRows ?? []) {
    if (b.effective_from > endKey) continue;
    const existing = currentBudgetByCategory.get(b.category_id);
    if (!existing || b.effective_from > existing.effectiveFrom) {
      currentBudgetByCategory.set(b.category_id, { amount: Number(b.monthly_amount), effectiveFrom: b.effective_from });
    }
  }

  const spentByCategory = new Map<string, number>();
  for (const t of monthToDateRows ?? []) {
    const signed = t.direction === 'debit' ? Number(t.amount) : -Number(t.amount);
    spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + signed);
  }

  const budgetTableRows: BudgetRow[] = (categoryRows ?? [])
    .filter((c) => c.txn_type === 'expense')
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0;
      return {
        categoryId: c.id,
        categoryName: c.name,
        budget: currentBudgetByCategory.get(c.id)?.amount ?? 0,
        spent,
        projected: projectMonthEnd(spent, viewedEnd),
      };
    })
    .sort((a, b) => b.spent - a.spent);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget vs actual</h1>
          <p className="text-sm text-muted-foreground">
            {viewedMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            {isCurrentMonth && ' - projected is a straight-line estimate from spend so far'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/budget?month=${prevMonthKey}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
          {canGoNext ? (
            <Link href={`/budget?month=${nextMonthKey}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'pointer-events-none opacity-50')}>
              Next
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <BudgetCard rows={budgetTableRows} />
      </Card>
    </main>
  );
}
