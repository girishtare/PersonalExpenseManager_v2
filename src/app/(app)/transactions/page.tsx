import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { TransactionsFilters } from './filters';
import { TransactionsPagination } from './pagination';
import { TransactionsTable, type TransactionRow } from './transactions-table';

const PAGE_SIZE = 100;

// Only real columns on the transactions table - PostgREST can't order the outer rows by a
// joined table's column (account/category name), only reorder within an embedded relation,
// which is a no-op for a to-one join. So account/category stay unsortable.
const SORTABLE_COLUMNS = ['txn_date', 'description_raw', 'amount'];

interface TransactionsSearchParams {
  page?: string;
  start?: string;
  end?: string;
  account?: string;
  category?: string;
  direction?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionsSearchParams>;
}) {
  const user = await requireOwnerUser();
  const supabase = await createClient();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const start = params.start ?? '';
  const end = params.end ?? '';
  const account = params.account ?? '';
  const category = params.category ?? '';
  const direction = params.direction ?? '';
  const q = params.q ?? '';
  const sortKey = params.sort && SORTABLE_COLUMNS.includes(params.sort) ? params.sort : 'txn_date';
  const sortDir: 'asc' | 'desc' = params.dir === 'asc' ? 'asc' : 'desc';

  let query = supabase
    .from('transactions')
    .select('id, txn_date, description_raw, amount, direction, category_id, account_id, accounts(display_name)', {
      count: 'exact',
    })
    .eq('user_id', user.id);

  if (start) query = query.gte('txn_date', start);
  if (end) query = query.lte('txn_date', end);
  if (account) query = query.eq('account_id', account);
  if (category) query = query.eq('category_id', category);
  if (direction) query = query.eq('direction', direction);
  if (q) query = query.ilike('description_raw', `%${q}%`);

  query = query.order(sortKey, { ascending: sortDir === 'asc' });
  // Tiebreaker so rows don't shift between pages when the primary sort column has duplicates.
  query = query.order('id', { ascending: true });

  const offset = (page - 1) * PAGE_SIZE;
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const [{ data: transactions, count }, { data: categories }, { data: accounts }] = await Promise.all([
    query,
    supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('name', { ascending: true }),
    supabase.from('accounts').select('id, display_name').eq('user_id', user.id).order('created_at', { ascending: true }),
  ]);

  const rows: TransactionRow[] = (transactions ?? []).map((t) => ({
    id: t.id,
    txn_date: t.txn_date,
    description_raw: t.description_raw,
    amount: Number(t.amount),
    direction: t.direction,
    category_id: t.category_id,
    account_id: t.account_id,
    account_name: (t.accounts as unknown as { display_name: string } | null)?.display_name ?? '',
  }));

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filterParams = new URLSearchParams();
  if (start) filterParams.set('start', start);
  if (end) filterParams.set('end', end);
  if (account) filterParams.set('account', account);
  if (category) filterParams.set('category', category);
  if (direction) filterParams.set('direction', direction);
  if (q) filterParams.set('q', q);
  const filterQuery = filterParams.toString();

  const fullParams = new URLSearchParams(filterParams);
  fullParams.set('sort', sortKey);
  fullParams.set('dir', sortDir);
  const fullQuery = fullParams.toString();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <TransactionsFilters
        accounts={accounts ?? []}
        categories={categories ?? []}
        start={start}
        end={end}
        account={account}
        category={category}
        direction={direction}
        q={q}
      />
      <Card className="p-4">
        <TransactionsTable
          transactions={rows}
          categories={categories ?? []}
          sortKey={sortKey}
          sortDir={sortDir}
          searchQuery={filterQuery}
        />
      </Card>
      <TransactionsPagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} searchQuery={fullQuery} />
    </main>
  );
}
