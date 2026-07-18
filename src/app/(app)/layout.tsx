import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requireOwnerUser } from '@/lib/auth/dal';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { signOut } from './actions';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/import', label: 'Import' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/categories', label: 'Categories' },
  { href: '/budget', label: 'Budget' },
  { href: '/reconciliation', label: 'CC Reconciliation' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOwnerUser();

  return (
    <div className="flex flex-1 flex-col bg-muted">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b border-border bg-card px-8 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Personal Expense Manager</span>
          <div className="flex gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-muted-foreground hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <form action={signOut} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{user.email}</span>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
