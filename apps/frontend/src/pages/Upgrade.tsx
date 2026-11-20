import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribe } from '../api/trends';
import { useAuth } from '../auth/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { useLimits } from '../lib/limits-context';

type View = 'idle' | 'upgrading' | 'done' | 'failed';

export default function Upgrade() {
  const { api } = useAuth();
  const { limits, refresh } = useLimits();
  const [view, setView] = useState<View>('idle');
  const busy = useRef(false);

  async function onUpgrade() {
    if (busy.current) return;
    busy.current = true;
    setView('upgrading');
    const out = await subscribe(api);
    busy.current = false;
    if (out.ok && out.data) {
      setView('done');
      void refresh({ fresh: true });
      return;
    }
    if (out.kind === 'unauthorized') return; // el cliente ya cerró la sesión
    setView('failed');
  }

  if (limits?.tier === 'paid') {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Upgrade</h1>
        <p className="text-sm text-gray-700">You&apos;re already on the Paid plan.</p>
        <Link to="/upload" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to upload
        </Link>
      </section>
    );
  }

  if (view === 'done') {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Upgrade</h1>
        <p className="text-sm text-gray-700">You&apos;re now on the Paid plan!</p>
        <Link to="/upload" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Continue
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">Upgrade</h1>
      <p className="text-sm text-gray-700">Unlimited uploads and full access to progress trends.</p>
      {view === 'failed' && (
        <Alert>
          <AlertDescription>Upgrade failed — please try again.</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        disabled={view === 'upgrading'}
        onClick={() => void onUpgrade()}
        className="self-start"
      >
        {view === 'upgrading' ? 'Upgrading…' : 'Upgrade to Paid'}
      </Button>
    </section>
  );
}
