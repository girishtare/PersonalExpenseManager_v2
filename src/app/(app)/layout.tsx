import Link from 'next/link';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/import', label: 'Import' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/categories', label: 'Categories' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex items-center gap-6 border-b border-zinc-200 px-8 py-4 dark:border-zinc-800">
        <span className="font-semibold">Personal Expense Manager</span>
        <div className="flex gap-4 text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-zinc-600 hover:underline dark:text-zinc-400">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
