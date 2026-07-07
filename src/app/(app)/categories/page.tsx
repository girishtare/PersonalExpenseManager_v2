import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { AddCategoryForm } from './add-category-form';
import { AddRuleForm } from './add-rule-form';
import { DeleteRuleButton } from './delete-rule-button';
import { RecalculateButton } from './recalculate-button';

export default async function CategoriesPage() {
  const user = await requireOwnerUser();
  const supabase = await createClient();

  const [{ data: categories }, { data: rules }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, type, user_id')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('categorization_rules')
      .select('id, pattern, match_type, direction, priority, user_id, categories(name)')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('priority', { ascending: true }),
  ]);

  const incomeCategories = (categories ?? []).filter((c) => c.type === 'income');
  const expenseCategories = (categories ?? []).filter((c) => c.type === 'expense');

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories &amp; rules</h1>
        <RecalculateButton />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Categories</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">Income</p>
            <ul className="flex flex-wrap gap-2">
              {incomeCategories.map((c) => (
                <li key={c.id} className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700">
                  {c.name}
                  {c.user_id && ' (custom)'}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">Expense</p>
            <ul className="flex flex-wrap gap-2">
              {expenseCategories.map((c) => (
                <li key={c.id} className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700">
                  {c.name}
                  {c.user_id && ' (custom)'}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <AddCategoryForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Categorization rules</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Pattern</th>
                <th className="py-2 pr-4">Match</th>
                <th className="py-2 pr-4">Direction</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((rule) => (
                <tr key={rule.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{rule.priority}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{rule.pattern}</td>
                  <td className="py-2 pr-4">{rule.match_type}</td>
                  <td className="py-2 pr-4">{rule.direction ?? 'any'}</td>
                  <td className="py-2 pr-4">
                    {(rule.categories as unknown as { name: string }[] | null)?.[0]?.name}
                  </td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {rule.user_id ? 'yours' : 'system'}
                  </td>
                  <td className="py-2">{rule.user_id && <DeleteRuleButton ruleId={rule.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRuleForm categories={categories ?? []} />
      </section>
    </main>
  );
}
