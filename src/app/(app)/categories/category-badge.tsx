'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TxnType } from '@/lib/transactions/type';
import { deleteCategory, updateCategory, updateCategoryTxnType } from './actions';

interface Category {
  id: string;
  name: string;
  user_id: string | null;
  txn_type: TxnType;
}

const TXN_TYPE_LABELS: Record<TxnType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  investment: 'Investment',
};

export function CategoryBadge({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [txnType, setTxnType] = useState<TxnType>(category.txn_type);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(category.name);
          setTxnType(category.txn_type);
          setError(null);
        }
      }}
    >
      <PopoverTrigger className={cn(badgeVariants({ variant: 'secondary' }), 'cursor-pointer gap-1')}>
        {category.name}
        <Pencil className="h-3 w-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={isPending} />
          <Select
            items={Object.entries(TXN_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={txnType}
            disabled={isPending}
            onValueChange={(v) => v && setTxnType(v as TxnType)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(TXN_TYPE_LABELS) as [TxnType, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteCategory(category.id);
                  if (result.error) setError(result.error);
                  else setOpen(false);
                })
              }
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const nameResult = await updateCategory(category.id, name);
                  if (nameResult.error) {
                    setError(nameResult.error);
                    return;
                  }
                  if (txnType !== category.txn_type) {
                    const typeResult = await updateCategoryTxnType(category.id, txnType);
                    if (typeResult.error) {
                      setError(typeResult.error);
                      return;
                    }
                  }
                  setOpen(false);
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
