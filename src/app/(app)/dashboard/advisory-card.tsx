import { Lightbulb, PiggyBank, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface Advisory {
  generatedAt: string;
  investmentTips: string[];
  spendingTips: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TipList({ tips }: { tips: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {tips.map((tip, i) => (
        <li key={i} className="text-sm leading-relaxed text-foreground">
          {tip}
        </li>
      ))}
    </ul>
  );
}

export function AdvisoryCard({ advisory }: { advisory: Advisory | null }) {
  const hasContent = !!advisory && (advisory.investmentTips.length > 0 || advisory.spendingTips.length > 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Financial advisory</h2>
        </div>
        {advisory && <span className="text-xs text-muted-foreground">Updated {formatDate(advisory.generatedAt)}</span>}
      </div>

      {!hasContent ? (
        <p className="text-sm text-muted-foreground">
          Your first daily analysis will appear here after tonight&apos;s update - it reviews your last 12 months of
          transactions for investment and spending suggestions.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {advisory.investmentTips.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Investment suggestions
              </div>
              <TipList tips={advisory.investmentTips} />
            </div>
          )}
          {advisory.spendingTips.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <PiggyBank className="h-3.5 w-3.5" />
                Spending reduction ideas
              </div>
              <TipList tips={advisory.spendingTips} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
