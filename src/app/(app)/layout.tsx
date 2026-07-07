import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { requireOwnerUser } from '@/lib/auth/dal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { signOut } from './actions';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/import', label: 'Import' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/categories', label: 'Categories' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOwnerUser();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b border-zinc-200 bg-white px-8 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Personal Expense Manager</span>
          <div className="flex gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-zinc-600 hover:underline dark:text-zinc-400">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <form action={signOut} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="hidden sm:inline">{user.email}</span>
            <button type="submit" className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
}
