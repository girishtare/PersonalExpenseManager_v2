/**
 * PostgREST silently caps every request at the project's max-rows setting (1000 here) no matter
 * what .limit() asks for - it returns fewer rows without any error. Any query that can plausibly
 * match more than 1000 rows must page through with .range() or it will silently truncate; this
 * first bit the similar-transactions search, then the dashboard's 12-month queries once the
 * dataset grew past 1000 transactions.
 *
 * Pass a factory (not a built query) - a PostgREST builder is single-use, so each page needs a
 * freshly built query to apply .range() to.
 */
export async function fetchAllRows<T>(buildQuery: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }> & {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
