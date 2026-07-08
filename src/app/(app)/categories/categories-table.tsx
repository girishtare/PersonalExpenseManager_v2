import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TxnType } from '@/lib/transactions/type';
import { CategoryBadge } from './category-badge';
import { CategoryTypeSelect } from './category-type-select';

interface Category {
  id: string;
  name: string;
  user_id: string | null;
  txn_type: TxnType;
}

export function CategoriesTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No categories yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <CategoryBadge category={c} />
            </TableCell>
            <TableCell>
              <CategoryTypeSelect categoryId={c.id} txnType={c.txn_type} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
