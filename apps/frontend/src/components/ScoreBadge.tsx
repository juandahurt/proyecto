import { Badge } from './ui/badge';

export type ScoreLevel = 'red' | 'yellow' | 'green';

/** Umbrales del sistema de diseño: < 50 rojo, 50–74 amarillo, ≥ 75 verde. */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

const LEVEL_CLASS: Record<ScoreLevel, string> = {
  red: 'bg-red-600 text-white',
  yellow: 'bg-yellow-600 text-white',
  green: 'bg-green-600 text-white',
};

/** El color nunca va solo: el texto y `aria-label` llevan el valor. */
export function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge
      role="img"
      aria-label={`Score ${score} out of 100`}
      className={LEVEL_CLASS[scoreLevel(score)]}
    >
      {`${score} / 100`}
    </Badge>
  );
}
