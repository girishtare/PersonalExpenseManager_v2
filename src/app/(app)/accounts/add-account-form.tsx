'use client';

import { useActionState } from 'react';
import { createAccount, type AddAccountState } from './actions';

const initialState: AddAccountState = {};

export function AddAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initialState);

  return (
    <form
      action={formAction}
      className="flex max-w-sm flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="font-medium">Add account</h2>

      <label className="flex flex-col gap-1 text-sm">
        Bank
        <select
          disabled
          defaultValue="HDFC"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        >
          <option value="HDFC">HDFC Bank</option>
        </select>
        <span className="text-xs text-zinc-500">More banks coming later.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Account type
        <select
          name="accountType"
          required
          defaultValue="savings"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        >
          <option value="savings">Savings</option>
          <option value="current">Current</option>
          <option value="credit_card">Credit Card</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="displayName"
          required
          placeholder="e.g. HDFC Salary Account"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Last 4 digits (optional)
        <input
          name="last4"
          maxLength={4}
          placeholder="1234"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? 'Adding…' : 'Add account'}
      </button>
    </form>
  );
}
