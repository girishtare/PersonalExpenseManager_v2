'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCategory, type AddCategoryState } from './actions';

const initialState: AddCategoryState = {};

const TXN_TYPE_LABELS = { expense: 'Expense', income: 'Income', transfer: 'Transfer', investment: 'Investment' };

export function AddCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategory, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" name="name" required placeholder="e.g. Rent" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-class">Class</Label>
        <Select name="type" items={{ income: 'Income', expense: 'Expense' }} defaultValue="expense">
          <SelectTrigger id="category-class" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-txn-type">Type</Label>
        <Select name="txnType" items={TXN_TYPE_LABELS} defaultValue="expense">
          <SelectTrigger id="category-txn-type" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(TXN_TYPE_LABELS) as [string, string][]).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add category'}
      </Button>
    </form>
  );
}
