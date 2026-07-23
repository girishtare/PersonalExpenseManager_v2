'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { setMerchantAlias } from '@/app/(app)/transactions/actions';

export function MerchantNameCell({
  merchantKey,
  descriptionRaw,
  aliasName,
}: {
  merchantKey: string;
  descriptionRaw: string;
  aliasName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(aliasName ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Too short a signature to reliably group this merchant across transactions (see
  // reduceDescription) - naming it here wouldn't apply consistently, so skip the affordance.
  if (merchantKey.length < 4) {
    return <span className="block max-w-xs truncate whitespace-normal">{descriptionRaw}</span>;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(aliasName ?? '');
          setError(null);
        }
      }}
    >
      <PopoverTrigger className="group flex max-w-xs items-start gap-1 text-left">
        <span className="min-w-0 flex-1">
          {aliasName ? (
            <>
              <span className="block truncate font-medium">{aliasName}</span>
              <span className="block truncate text-xs text-muted-foreground">{descriptionRaw}</span>
            </>
          ) : (
            <span className="block truncate whitespace-normal">{descriptionRaw}</span>
          )}
        </span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Applies to every transaction from this merchant.</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={descriptionRaw} maxLength={80} disabled={isPending} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending || !aliasName}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await setMerchantAlias(merchantKey, '');
                    setName('');
                    setOpen(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to clear name.');
                  }
                })
              }
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await setMerchantAlias(merchantKey, name);
                    setOpen(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to save name.');
                  }
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
