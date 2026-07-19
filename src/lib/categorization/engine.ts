import type { SupabaseClient } from '@supabase/supabase-js';
import type { TxnDirection } from '../bank-adapters/types';

export interface CategorizationRule {
  id: string;
  category_id: string;
  match_type: 'contains' | 'starts_with' | 'exact' | 'regex';
  pattern: string;
  direction: TxnDirection | null;
  priority: number;
  user_id: string | null;
}

function ruleMatches(rule: CategorizationRule, descriptionNormalized: string, direction: TxnDirection): boolean {
  if (rule.direction && rule.direction !== direction) return false;

  const pattern = rule.pattern.toLowerCase();
  switch (rule.match_type) {
    case 'contains':
      return descriptionNormalized.includes(pattern);
    case 'starts_with':
      return descriptionNormalized.startsWith(pattern);
    case 'exact':
      return descriptionNormalized === pattern;
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(descriptionNormalized);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export interface CategorizationResult {
  categoryId: string;
  ruleId: string | null;
}

/**
 * Precedence: rules are expected pre-sorted by priority ascending, with user-defined /
 * override-derived rules ordered ahead of system rules at the same priority (see
 * `loadActiveRules`). First match wins; no match falls back to Uncategorized. Callers are
 * responsible for skipping this entirely when `is_manual_override` is true on a transaction.
 */
export function categorizeTransaction(
  descriptionRaw: string,
  direction: TxnDirection,
  rules: CategorizationRule[],
  uncategorizedCategoryId: string
): CategorizationResult {
  const normalized = descriptionRaw.trim().toLowerCase();
  for (const rule of rules) {
    if (ruleMatches(rule, normalized, direction)) {
      return { categoryId: rule.category_id, ruleId: rule.id };
    }
  }
  return { categoryId: uncategorizedCategoryId, ruleId: null };
}

/** Loads the active rule set (system rules + this user's own) ready to pass to `categorizeTransaction`. */
export async function loadActiveRules(
  supabase: SupabaseClient,
  userId: string
): Promise<CategorizationRule[]> {
  const { data, error } = await supabase
    .from('categorization_rules')
    .select('id, category_id, match_type, pattern, direction, priority, user_id')
    .eq('is_active', true)
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (error) throw error;

  return ((data ?? []) as CategorizationRule[]).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Tie-break: user/override-derived rules win over generic system rules at equal priority.
    return (a.user_id ? 0 : 1) - (b.user_id ? 0 : 1);
  });
}

export async function getUncategorizedCategoryId(supabase: SupabaseClient): Promise<string> {
  // Tolerates both "Uncategorized" and "Uncategorised" - the app can't stop a category badge
  // rename from spelling it either way, so the fallback lookup shouldn't depend on one exact
  // spelling (see also the rename/delete guard in categories/actions.ts).
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .is('user_id', null)
    .ilike('name', 'uncategori_ed')
    .single();

  if (error || !data) {
    throw new Error('System "Uncategorized" category is missing - check that seed migrations ran.');
  }
  return data.id;
}
