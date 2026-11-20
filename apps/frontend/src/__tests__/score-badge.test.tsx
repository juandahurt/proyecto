import { render, screen } from '@testing-library/react';
import { ScoreBadge, scoreLevel } from '../components/ScoreBadge';

describe('ScoreBadge', () => {
  it.each([
    [0, 'red', 'bg-red-600'],
    [49, 'red', 'bg-red-600'],
    [50, 'yellow', 'bg-yellow-600'],
    [74, 'yellow', 'bg-yellow-600'],
    [75, 'green', 'bg-green-600'],
    [100, 'green', 'bg-green-600'],
  ])('score %i es %s', (score, level, cls) => {
    expect(scoreLevel(score)).toBe(level);
    render(<ScoreBadge score={score} />);
    const badge = screen.getByLabelText(`Score ${score} out of 100`);
    expect(badge).toHaveTextContent(`${score} / 100`);
    expect(badge).toHaveClass(cls);
  });

  it('solo lleva la clase de su color', () => {
    render(<ScoreBadge score={72} />);
    const badge = screen.getByLabelText('Score 72 out of 100');
    expect(badge).toHaveClass('bg-yellow-600');
    expect(badge).not.toHaveClass('bg-green-600');
    expect(badge).not.toHaveClass('bg-red-600');
  });
});
