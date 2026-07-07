'use client';

import { useState } from 'react';

interface Account {
  id: string;
  display_name: string;
}

interface ImportResult {
  transactionsImported: number;
  transactionsDuplicate: number;
  warnings: string[];
}

export function UploadForm({ accounts }: { accounts: Account[] }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/import', { method: 'POST', body: formData });
      const body = await response.json();

      if (!response.ok) {
        setNeedsPassword(Boolean(body.passwordError));
        setError(body.error ?? 'Import failed.');
        return;
      }

      setNeedsPassword(false);
      setResult(body);
    } catch {
      setError('Something went wrong while uploading. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Add an account first on the Accounts page before importing a statement.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <label className="flex flex-col gap-1 text-sm">
        Account
        <select name="accountId" required className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700">
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Statement file (.csv, .xlsx, or .pdf)
        <input name="file" type="file" accept=".csv,.xlsx,.xls,.pdf" required className="text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        PDF password (if password-protected)
        <input
          name="password"
          type="password"
          placeholder="Only needed for protected PDFs"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600">
          {error}
          {needsPassword && ' Enter the password above and try again.'}
        </p>
      )}

      {result && (
        <div className="rounded border border-green-600/30 bg-green-600/10 p-3 text-sm">
          <p>
            Imported {result.transactionsImported} transaction{result.transactionsImported === 1 ? '' : 's'}
            {result.transactionsDuplicate > 0 && ` (${result.transactionsDuplicate} duplicate skipped)`}.
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-400">
              {result.warnings.slice(0, 10).map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
              {result.warnings.length > 10 && <li>...and {result.warnings.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? 'Uploading…' : 'Upload statement'}
      </button>
    </form>
  );
}
