'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pattern">Pattern</Label>
        <Input id="pattern" name="pattern" required placeholder="e.g. STARBUCKS" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="matchType">Match type</Label>
        <Select
          name="matchType"
          items={{ contains: 'Contains', starts_with: 'Starts with', exact: 'Exact', regex: 'Regex' }}
          defaultValue="contains"
        >
          <SelectTrigger id="matchType" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="starts_with">Starts with</SelectItem>
            <SelectItem value="exact">Exact</SelectItem>
            <SelectItem value="regex">Regex</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="direction">Direction</Label>
        <Select name="direction" items={{ any: 'Any', debit: 'Debit', credit: 'Credit' }} defaultValue="any">
          <SelectTrigger id="direction" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="debit">Debit</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <Select name="categoryId" items={categories.map((c) => ({ value: c.id, label: c.name }))} required>
          <SelectTrigger id="categoryId" className="w-44">
            <SelectValue placeholder="Choose a category" />
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
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priority">Priority</Label>
        <Input id="priority" name="priority" type="number" defaultValue={5} min={1} max={1000} className="w-20" />
      </div>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add rule'}
      </Button>
    </form>
  );
}
