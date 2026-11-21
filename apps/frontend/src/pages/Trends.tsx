import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CategoryTrend } from '@proyecto/shared-types';
import { getTrends, type TrendsData } from '../api/trends';
import { useAuth } from '../auth/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { TrendChart } from '../components/TrendChart';

type View = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; data: TrendsData };

const DIRECTION_LABEL: Record<'improving' | 'stagnating' | 'worsening', string> = {
  improving: 'Improving',
  stagnating: 'Stagnating',
  worsening: 'Worsening',
};

const DIRECTION_CLASS: Record<'improving' | 'stagnating' | 'worsening', string> = {
  improving: 'bg-green-600 text-white',
  stagnating: 'bg-gray-500 text-white',
  worsening: 'bg-red-600 text-white',
};

/** `1 more upload needed` vs `2 more uploads needed`. */
function uploadsNeededText(uploadsNeeded: number): string {
  const unit = uploadsNeeded === 1 ? 'upload' : 'uploads';
  return `${uploadsNeeded} more ${unit} needed`;
}

function CategoryCard({ category }: { category: CategoryTrend }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
        {category.categoryName.toUpperCase()}
      </h2>

      {category.status === 'locked' && (
        <div className="flex flex-col items-start gap-2">
          <Badge className="bg-gray-200 text-gray-700">Locked</Badge>
          <Link to="/upgrade" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Upgrade to see trends
          </Link>
        </div>
      )}

      {category.status === 'insufficient_data' && (
        <div className="flex flex-col items-start gap-1">
          <Badge className="bg-gray-200 text-gray-700">Not enough data yet</Badge>
          <p className="text-sm text-gray-600">{uploadsNeededText(category.uploadsNeeded ?? 0)}</p>
        </div>
      )}

      {(category.status === 'improving' ||
        category.status === 'stagnating' ||
        category.status === 'worsening') &&
        category.trend && (
          <div className="flex flex-col items-start gap-2">
            <Badge className={DIRECTION_CLASS[category.status]}>
              {DIRECTION_LABEL[category.status]}
            </Badge>
            <TrendChart direction={category.status} scoreHistory={category.trend.scoreHistory} />
          </div>
        )}
    </article>
  );
}

export default function Trends() {
  const { api } = useAuth();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setView({ kind: 'loading' });
    void getTrends(api).then((out) => {
      if (cancelled) return;
      if (out.ok && out.data) setView({ kind: 'loaded', data: out.data });
      else if (out.kind !== 'unauthorized') setView({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gray-900">Progress Trends</h1>

      {view.kind === 'loading' && (
        <div role="status" className="text-sm text-gray-600">
          Loading&hellip;
        </div>
      )}

      {view.kind === 'failed' && (
        <div className="flex flex-col items-start gap-3">
          <Alert>
            <AlertDescription>We could not load your trends. Please try again.</AlertDescription>
          </Alert>
          <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      {view.kind === 'loaded' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {view.data.categories.map((category) => (
            <CategoryCard key={category.categoryId} category={category} />
          ))}
        </div>
      )}
    </section>
  );
}
