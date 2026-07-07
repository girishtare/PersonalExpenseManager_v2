import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function TransactionsPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  searchQuery,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  searchQuery: string;
}) {
  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const prefix = searchQuery ? `${searchQuery}&` : '';

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <p>
        Showing {from}&ndash;{to} of {totalCount}
      </p>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={`/transactions?${prefix}page=${page - 1}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Previous
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'pointer-events-none opacity-50')}>Previous</span>
        )}
        <span>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={`/transactions?${prefix}page=${page + 1}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Next
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'pointer-events-none opacity-50')}>Next</span>
        )}
      </div>
    </div>
  );
}
