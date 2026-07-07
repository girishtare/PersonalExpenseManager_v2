'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    return <p className="text-sm text-muted-foreground">Add an account first on the Accounts page before importing a statement.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="flex max-w-sm flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountId">Account</Label>
          <Select
            name="accountId"
            items={accounts.map((account) => ({ value: account.id, label: account.display_name }))}
            defaultValue={accounts[0]?.id}
            required
          >
            <SelectTrigger id="accountId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="file">Statement file (.csv, .xlsx, or .pdf)</Label>
          <Input id="file" name="file" type="file" accept=".csv,.xlsx,.xls,.pdf" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">PDF password (if password-protected)</Label>
          <Input id="password" name="password" type="password" placeholder="Only needed for protected PDFs" />
        </div>

        {error && (
          <p className="text-sm text-destructive">
            {error}
            {needsPassword && ' Enter the password above and try again.'}
          </p>
        )}

        {result && (
          <div className="rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm">
            <p>
              Imported {result.transactionsImported} transaction{result.transactionsImported === 1 ? '' : 's'}
              {result.transactionsDuplicate > 0 && ` (${result.transactionsDuplicate} duplicate skipped)`}.
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                {result.warnings.slice(0, 10).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
                {result.warnings.length > 10 && <li>...and {result.warnings.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? 'Uploading…' : 'Upload statement'}
        </Button>
      </Card>
    </form>
  );
}
