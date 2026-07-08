import { revalidatePath } from 'next/cache';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { categorizeTransaction, getUncategorizedCategoryId, loadActiveRules } from '@/lib/categorization/engine';

export const maxDuration = 60;

function encodeLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n');
}

/**
 * Streams newline-delimited JSON progress updates ({ status } while running, then either
 * { done, updatedCount } or { error }) so the client can show what step recalculation is on -
 * this can take a while over a large transaction set since each row is updated individually.
 */
export async function POST() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encodeLine({ status: 'Loading categorization rules...' }));
        const rules = await loadActiveRules(supabase, user.id);
        const uncategorizedId = await getUncategorizedCategoryId(supabase);

        controller.enqueue(encodeLine({ status: 'Loading transactions...' }));
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('id, description_raw, direction')
          .eq('user_id', user.id)
          .eq('is_manual_override', false);

        if (error || !transactions) {
          controller.enqueue(encodeLine({ error: error?.message ?? 'Could not load transactions' }));
          return;
        }

        const total = transactions.length;
        let updatedCount = 0;
        controller.enqueue(encodeLine({ status: `Recalculating 0 of ${total} transactions...` }));

        for (let i = 0; i < transactions.length; i++) {
          const txn = transactions[i];
          const { categoryId, ruleId } = categorizeTransaction(txn.description_raw, txn.direction, rules, uncategorizedId);
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ category_id: categoryId, categorization_rule_id: ruleId })
            .eq('id', txn.id);
          if (!updateError) updatedCount++;

          if ((i + 1) % 20 === 0 || i === transactions.length - 1) {
            controller.enqueue(encodeLine({ status: `Recalculating ${i + 1} of ${total} transactions...` }));
          }
        }

        revalidatePath('/transactions');
        revalidatePath('/dashboard');
        controller.enqueue(encodeLine({ done: true, updatedCount }));
      } catch (err) {
        controller.enqueue(encodeLine({ error: err instanceof Error ? err.message : 'Unknown error while recalculating' }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}
