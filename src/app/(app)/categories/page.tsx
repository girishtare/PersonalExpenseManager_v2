import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { AddCategoryForm } from './add-category-form';
import { AddRuleForm } from './add-rule-form';
import { CategoryBadge } from './category-badge';
import { RecalculateButton } from './recalculate-button';
import { RulesTable } from './rules-table';

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
      .select('id, category_id, pattern, match_type, direction, priority, user_id')
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">Add category</h2>
          <AddCategoryForm />
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-medium">Add rule</h2>
          <AddRuleForm categories={categories ?? []} />
        </Card>
      </section>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Categories</h2>
        <p className="text-xs text-muted-foreground">Click a category to rename or delete it.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Income</p>
            <div className="flex flex-wrap gap-2">
              {incomeCategories.map((c) => (
                <CategoryBadge key={c.id} category={c} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Expense</p>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map((c) => (
                <CategoryBadge key={c.id} category={c} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Categorization rules</h2>
        <p className="text-xs text-muted-foreground">
          Changing the category on a system rule creates your own override at a higher priority rather than
          modifying the shared rule directly - the original stays in the list, but your version takes precedence.
        </p>
        <RulesTable rules={rules ?? []} categories={categories ?? []} />
      </Card>
    </main>
  );
}
