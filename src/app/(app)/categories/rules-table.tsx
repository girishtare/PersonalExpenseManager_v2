'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DeleteRuleButton } from './delete-rule-button';
import { RuleCategoryPicker } from './rule-category-picker';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Rule {
  id: string;
  category_id: string;
  pattern: string;
  match_type: string;
  direction: string | null;
  priority: number;
  user_id: string | null;
}

type SortColumn = 'priority' | 'pattern' | 'match_type' | 'direction' | 'category_name' | 'source';
type SortDirection = 'asc' | 'desc';

function SortHeader({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 hover:text-foreground">
      {children}
      {active ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

export function RulesTable({ rules, categories }: { rules: Rule[]; categories: Category[] }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  const rows = useMemo(() => {
    let result = rules;

    const q = search.trim().toLowerCase();
    if (q) result = result.filter((r) => r.pattern.toLowerCase().includes(q));
    if (categoryFilter !== 'all') result = result.filter((r) => r.category_id === categoryFilter);
    if (directionFilter !== 'all') result = result.filter((r) => (r.direction ?? 'any') === directionFilter);
    if (sourceFilter !== 'all') result = result.filter((r) => (r.user_id ? 'yours' : 'system') === sourceFilter);

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'priority':
          cmp = a.priority - b.priority;
          break;
        case 'pattern':
          cmp = a.pattern.localeCompare(b.pattern);
          break;
        case 'match_type':
          cmp = a.match_type.localeCompare(b.match_type);
          break;
        case 'direction':
          cmp = (a.direction ?? 'any').localeCompare(b.direction ?? 'any');
          break;
        case 'category_name':
          cmp = (categoryNameById.get(a.category_id) ?? '').localeCompare(categoryNameById.get(b.category_id) ?? '');
          break;
        case 'source':
          cmp = (a.user_id ? 'yours' : 'system').localeCompare(b.user_id ? 'yours' : 'system');
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rules, search, categoryFilter, directionFilter, sourceFilter, sortColumn, sortDirection, categoryNameById]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Search pattern</span>
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Category</span>
          <Select
            items={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryFilter}
            onValueChange={(v) => v && setCategoryFilter(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Direction</span>
          <Select
            items={{ all: 'All', any: 'Any', debit: 'Debit', credit: 'Credit' }}
            value={directionFilter}
            onValueChange={(v) => v && setDirectionFilter(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Source</span>
          <Select
            items={{ all: 'All', system: 'System', yours: 'Yours' }}
            value={sourceFilter}
            onValueChange={(v) => v && setSourceFilter(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="yours">Yours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader active={sortColumn === 'priority'} direction={sortDirection} onClick={() => toggleSort('priority')}>
                  Priority
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader active={sortColumn === 'pattern'} direction={sortDirection} onClick={() => toggleSort('pattern')}>
                  Pattern
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'match_type'}
                  direction={sortDirection}
                  onClick={() => toggleSort('match_type')}
                >
                  Match
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'direction'}
                  direction={sortDirection}
                  onClick={() => toggleSort('direction')}
                >
                  Direction
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortColumn === 'category_name'}
                  direction={sortDirection}
                  onClick={() => toggleSort('category_name')}
                >
                  Category
                </SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader active={sortColumn === 'source'} direction={sortDirection} onClick={() => toggleSort('source')}>
                  Source
                </SortHeader>
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.priority}</TableCell>
                <TableCell className="font-mono text-xs">{rule.pattern}</TableCell>
                <TableCell>{rule.match_type}</TableCell>
                <TableCell>{rule.direction ?? 'any'}</TableCell>
                <TableCell>
                  <RuleCategoryPicker rule={rule} categories={categories} />
                </TableCell>
                <TableCell className="text-muted-foreground">{rule.user_id ? 'yours' : 'system'}</TableCell>
                <TableCell>{rule.user_id && <DeleteRuleButton ruleId={rule.id} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No rules match these filters.</p>
      )}
    </div>
  );
}
