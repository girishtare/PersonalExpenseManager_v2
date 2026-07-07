'use client';

import { useState, useTransition } from 'react';
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

interface Rule {
  id: string;
  user_id: string | null;
  pattern: string;
  match_type: string;
  direction: string | null;
  priority: number;
  category_id: string;
}

export function RuleCategoryPicker({ rule, categories }: { rule: Rule; categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(rule.category_id);

  return (
    <Select
      items={categories.map((c) => ({ value: c.id, label: c.name }))}
      value={value}
      disabled={isPending}
      onValueChange={(newCategoryId) => {
        if (!newCategoryId) return;
        setValue(newCategoryId);
        startTransition(() => {
          updateRuleCategory(
            {
              id: rule.id,
              userId: rule.user_id,
              pattern: rule.pattern,
              matchType: rule.match_type,
              direction: rule.direction,
              priority: rule.priority,
            },
            newCategoryId
          );
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
