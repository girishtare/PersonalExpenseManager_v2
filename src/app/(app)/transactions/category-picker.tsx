'use client';

import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { bulkUpdateTransactionCategory, findSimilarTransactions, updateTransactionCategory, type SimilarTransaction } from './actions';

interface Category {
  id: string;
  name: string;
  type: string;
}

const formatAmount = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

export function CategoryPicker({
  transactionId,
  categoryId,
  categories,
}: {
  transactionId: string;
  categoryId: string;
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(categoryId);
  const [similar, setSimilar] = useState<SimilarTransaction[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, startApplying] = useTransition();

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function handleChange(newCategoryId: string | null) {
    if (!newCategoryId) return;
    setValue(newCategoryId);
    startTransition(async () => {
      await updateTransactionCategory(transactionId, newCategoryId);
      const matches = await findSimilarTransactions(transactionId);
      if (matches.length > 0) {
        setSimilar(matches);
        setSelected(new Set(matches.map((m) => m.id)));
      }
    });
  }

  function closeDialog() {
    setSimilar(null);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <Select
        items={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={value}
        disabled={isPending}
        onValueChange={handleChange}
      >
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Income</SelectLabel>
            {categories
              .filter((c) => c.type === 'income')
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Expense</SelectLabel>
            {categories
              .filter((c) => c.type === 'expense')
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Dialog open={similar !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to similar transactions?</DialogTitle>
            <DialogDescription>
              Found {similar?.length ?? 0} other transaction{similar?.length === 1 ? '' : 's'} with a similar
              description. Uncheck any you don&apos;t want changed, then apply.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {similar?.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-xs hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(t.id)}
                  onCheckedChange={() => toggleSelected(t.id)}
                  className="mt-0.5"
                />
                <span className="flex-1 truncate" title={t.description_raw}>
                  {t.description_raw}
                </span>
                <span className="text-muted-foreground">{t.txn_date}</span>
                <span className="tabular-nums">{formatAmount(t.amount)}</span>
                <span className="text-muted-foreground">{categoryNameById.get(t.category_id) ?? 'Uncategorized'}</span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={applying} onClick={closeDialog}>
              Skip
            </Button>
            <Button
              type="button"
              disabled={applying || selected.size === 0}
              onClick={() =>
                startApplying(async () => {
                  await bulkUpdateTransactionCategory([...selected], value);
                  closeDialog();
                })
              }
            >
              Apply to {selected.size} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
