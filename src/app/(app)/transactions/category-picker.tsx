'use client';

import { useTransition } from 'react';
import { updateTransactionCategory } from './actions';

interface Category {
  id: string;
  name: string;
  type: string;
}

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

  return (
    <select
      defaultValue={categoryId}
      disabled={isPending}
      onChange={(event) => {
        const newCategoryId = event.target.value;
        startTransition(() => {
          updateTransactionCategory(transactionId, newCategoryId);
        });
      }}
      className="rounded border border-zinc-300 bg-transparent px-1 py-0.5 text-xs dark:border-zinc-700"
    >
      <optgroup label="Income">
        {categories
          .filter((c) => c.type === 'income')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </optgroup>
      <optgroup label="Expense">
        {categories
          .filter((c) => c.type === 'expense')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </optgroup>
    </select>
  );
}
