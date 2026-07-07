import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddCategoryForm } from './add-category-form';
import { AddRuleForm } from './add-rule-form';
import { DeleteRuleButton } from './delete-rule-button';
import { RecalculateButton } from './recalculate-button';
import { RuleCategoryPicker } from './rule-category-picker';

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Income</p>
            <div className="flex flex-wrap gap-2">
              {incomeCategories.map((c) => (
                <Badge key={c.id} variant="secondary">
                  {c.name}
                  {c.user_id && ' (custom)'}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Expense</p>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map((c) => (
                <Badge key={c.id} variant="secondary">
                  {c.name}
                  {c.user_id && ' (custom)'}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">Categorization rules</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Pattern</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Source</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rules ?? []).map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.priority}</TableCell>
                <TableCell className="font-mono text-xs">{rule.pattern}</TableCell>
                <TableCell>{rule.match_type}</TableCell>
                <TableCell>{rule.direction ?? 'any'}</TableCell>
                <TableCell>
                  {rule.user_id ? (
                    <RuleCategoryPicker ruleId={rule.id} categoryId={rule.category_id} categories={categories ?? []} />
                  ) : (
                    (categories ?? []).find((c) => c.id === rule.category_id)?.name
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{rule.user_id ? 'yours' : 'system'}</TableCell>
                <TableCell>{rule.user_id && <DeleteRuleButton ruleId={rule.id} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </main>
  );
}
