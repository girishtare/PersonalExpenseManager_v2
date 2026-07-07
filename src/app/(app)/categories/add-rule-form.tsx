'use client';

import { useActionState } from 'react';
import { createRule, type AddRuleState } from './actions';

interface Category {
  id: string;
  name: string;
  type: string;
}

const initialState: AddRuleState = {};

export function AddRuleForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(createRule, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 text-sm">
        Pattern
        <input
          name="pattern"
          required
          placeholder="e.g. STARBUCKS"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Match type
        <select name="matchType" defaultValue="contains" className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
          <option value="contains">Contains</option>
          <option value="starts_with">Starts with</option>
          <option value="exact">Exact</option>
          <option value="regex">Regex</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Direction
        <select name="direction" defaultValue="any" className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
          <option value="any">Any</option>
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category
        <select name="categoryId" required className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
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
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Priority
        <input
          name="priority"
          type="number"
          defaultValue={5}
          min={1}
          max={1000}
          className="w-20 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? 'Adding…' : 'Add rule'}
      </button>
    </form>
  );
}
