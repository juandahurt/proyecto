import { useNavigate } from 'react-router-dom';
import { formatResetDate } from '../lib/format-date';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface Props {
  uploadsLimit: number | null;
  resetDate: string | null;
}

/** Pantalla 2B: sustituye a la zona de arrastre cuando no quedan subidas. */
export function UpgradePrompt({ uploadsLimit, resetDate }: Props) {
  const navigate = useNavigate();
  const reset = formatResetDate(resetDate);
  const used = uploadsLimit !== null ? `all ${uploadsLimit} uploads` : 'all your uploads';
  const text = `You've used ${used} for this month.${reset ? ` Resets on ${reset} (UTC).` : ''}`;
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 p-6">
        <p className="text-sm text-gray-900">{text}</p>
        <Button type="button" onClick={() => navigate('/upgrade')}>
          Upgrade for unlimited uploads
        </Button>
      </CardContent>
    </Card>
  );
}
