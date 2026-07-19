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
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [applying, startApplying] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function handleChange(newCategoryId: string | null) {
    if (!newCategoryId) return;
    setValue(newCategoryId);
    setError(null);
    startTransition(async () => {
      try {
        // Look up matches before writing anything - committing first would revalidate the page
        // and could tear down this row (e.g. if a category filter is active) before the dialog
        // ever gets to show.
        const matches = await findSimilarTransactions(transactionId, newCategoryId);
        if (matches.length > 0) {
          setSimilar(matches);
          setSelected(new Set(matches.map((m) => m.id)));
          setPendingCategoryId(newCategoryId);
        } else {
          await updateTransactionCategory(transactionId, newCategoryId);
        }
      } catch (err) {
        // startTransition swallows exceptions from an async callback rather than surfacing
        // them anywhere - without this catch, a transient failure here looks like the picker
        // silently doing nothing, indistinguishable from the request never having happened.
        setValue(categoryId);
        setError(err instanceof Error ? err.message : 'Could not update category. Please try again.');
      }
    });
  }

  function closeDialog() {
    setSimilar(null);
    setSelected(new Set());
    setPendingCategoryId(null);
    setError(null);
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
      <div className="flex flex-col gap-0.5">
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
        {error && !similar && <span className="text-xs text-destructive">{error}</span>}
      </div>

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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={applying}
              onClick={() =>
                startApplying(async () => {
                  try {
                    if (pendingCategoryId) await updateTransactionCategory(transactionId, pendingCategoryId);
                    closeDialog();
                  } catch (err) {
                    // Leave the dialog open with the selection intact so the user can just
                    // retry, rather than silently doing nothing (see handleChange for why this
                    // try/catch is required around every server-action call in this component).
                    setError(err instanceof Error ? err.message : 'Could not update category. Please try again.');
                  }
                })
              }
            >
              Skip
            </Button>
            <Button
              type="button"
              disabled={applying || selected.size === 0 || !pendingCategoryId}
              onClick={() =>
                startApplying(async () => {
                  try {
                    if (pendingCategoryId) {
                      await bulkUpdateTransactionCategory([transactionId, ...selected], pendingCategoryId);
                    }
                    closeDialog();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not apply category to selected transactions. Please try again.');
                  }
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
