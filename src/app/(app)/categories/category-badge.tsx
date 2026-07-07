'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { deleteCategory, updateCategory } from './actions';

interface Category {
  id: string;
  name: string;
  user_id: string | null;
}

export function CategoryBadge({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(category.name);
          setError(null);
        }
      }}
    >
      <PopoverTrigger className={cn(badgeVariants({ variant: 'secondary' }), 'cursor-pointer gap-1')}>
        {category.name}
        <Pencil className="h-3 w-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={isPending} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteCategory(category.id);
                  if (result.error) setError(result.error);
                  else setOpen(false);
                })
              }
            >
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await updateCategory(category.id, name);
                  if (result.error) setError(result.error);
                  else setOpen(false);
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
