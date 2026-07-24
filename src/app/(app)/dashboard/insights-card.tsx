import { CircleAlert, CircleCheck, Info, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Insight } from '@/lib/dashboard/insights';

// Status icons rather than trend arrows - an up-arrow next to "44% below average" would read as
// contradictory even when colored green, since the arrow's direction and the tone's meaning
// (good/bad news) aren't always the same thing (spending down is good, income down is bad).
const TONE_STYLES: Record<Insight['tone'], { Icon: typeof Info; className: string }> = {
  positive: { Icon: CircleCheck, className: 'text-emerald-600 dark:text-emerald-500' },
  negative: { Icon: CircleAlert, className: 'text-destructive' },
  neutral: { Icon: Info, className: 'text-muted-foreground' },
};

export function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">Summary</h2>
      </div>
      <ul className="flex flex-col gap-3">
        {insights.map((insight) => {
          const { Icon, className } = TONE_STYLES[insight.tone];
          return (
            <li key={insight.id} className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
              <p className="text-sm leading-relaxed text-foreground">{insight.text}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
