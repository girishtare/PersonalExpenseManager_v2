'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAccount, type AddAccountState } from './actions';

const initialState: AddAccountState = {};

export function AddAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initialState);

  return (
    <form action={formAction}>
      <Card className="flex max-w-sm flex-col gap-3 p-4">
        <h2 className="font-medium">Add account</h2>

        <div className="flex flex-col gap-1.5">
          <Label>Bank</Label>
          <Select defaultValue="HDFC" disabled>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HDFC">HDFC Bank</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">More banks coming later.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountType">Account type</Label>
          <Select name="accountType" defaultValue="savings" required>
            <SelectTrigger id="accountType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Name</Label>
          <Input id="displayName" name="displayName" required placeholder="e.g. HDFC Salary Account" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="last4">Last 4 digits (optional)</Label>
          <Input id="last4" name="last4" maxLength={4} placeholder="1234" />
        </div>

        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add account'}
        </Button>
      </Card>
    </form>
  );
}
