export type ScoreLevel = 'red' | 'yellow' | 'green';

export function scoreLevel(_score: number): ScoreLevel {
  return 'red';
}

export function ScoreBadge(_props: { score: number }) {
  return null;
}
