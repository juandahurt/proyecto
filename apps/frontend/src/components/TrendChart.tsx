import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TrendPoint } from '@proyecto/shared-types';

export type TrendDirectionOnly = 'improving' | 'stagnating' | 'worsening';

/** Mismos tonos que `DIRECTION_CLASS` de `Trends.tsx` (design-system-mapping.md). */
const STROKE_BY_DIRECTION: Record<TrendDirectionOnly, string> = {
  improving: '#16A34A', // green-600
  stagnating: '#6B7280', // gray-500
  worsening: '#DC2626', // red-600
};

/** `62 → 68 → 74`: el mismo texto que el gráfico reemplaza, para accesibilidad (CA-4). */
export function scoreHistoryText(scoreHistory: TrendPoint[]): string {
  return scoreHistory.map((p) => p.score).join(' → ');
}

export function TrendChart({
  direction,
  scoreHistory,
}: {
  direction: TrendDirectionOnly;
  scoreHistory: TrendPoint[];
}) {
  const data = scoreHistory.map((p, i) => ({ index: i, score: p.score }));
  const accessibleText = scoreHistoryText(scoreHistory);

  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden="true"
        className="h-[160px] w-full"
        data-testid="trend-chart"
        data-direction={direction}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={0}>
          <LineChart data={data}>
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              stroke={STROKE_BY_DIRECTION[direction]}
              strokeWidth={2}
              dot
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{accessibleText}</p>
    </div>
  );
}
