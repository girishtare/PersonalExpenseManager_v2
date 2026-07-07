'use client';

import { useActionState } from 'react';
import { createCategory, type AddCategoryState } from './actions';

const initialState: AddCategoryState = {};

export function AddCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategory, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="name"
          required
          placeholder="e.g. Rent"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          name="type"
          defaultValue="expense"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? 'Adding…' : 'Add category'}
      </button>
    </form>
  );
}
