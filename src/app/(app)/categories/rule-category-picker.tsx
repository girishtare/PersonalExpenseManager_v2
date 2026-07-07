'use client';

import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateRuleCategory } from './actions';

interface Category {
  id: string;
  name: string;
  type: string;
}

export function RuleCategoryPicker({
  ruleId,
  categoryId,
  categories,
}: {
  ruleId: string;
  categoryId: string;
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      defaultValue={categoryId}
      disabled={isPending}
      onValueChange={(newCategoryId) => {
        if (!newCategoryId) return;
        startTransition(() => {
          updateRuleCategory(ruleId, newCategoryId);
        });
      }}
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
  );
}
