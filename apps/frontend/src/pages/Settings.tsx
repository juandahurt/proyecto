import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteHistory } from '../api/settings';
import { useAuth } from '../auth/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { useLimits } from '../lib/limits-context';

type View = 'idle' | 'confirming' | 'deleting' | 'done' | 'failed';

const CONFIRMATION_WORD = 'DELETE';

export default function Settings() {
  const { api } = useAuth();
  const { refresh } = useLimits();
  const [view, setView] = useState<View>('idle');
  const [confirmText, setConfirmText] = useState('');
  const busy = useRef(false);

  function openConfirmation() {
    setConfirmText('');
    setView('confirming');
  }

  function cancel() {
    setConfirmText('');
    setView('idle');
  }

  async function onConfirmDelete() {
    if (busy.current) return;
    busy.current = true;
    setView('deleting');
    const out = await deleteHistory(api);
    busy.current = false;
    if (out.ok) {
      setView('done');
      void refresh({ fresh: true });
      return;
    }
    if (out.kind === 'unauthorized') return; // el cliente ya cerró la sesión
    setView('failed');
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <Link to="/policy" className="text-sm font-medium text-blue-600 hover:text-blue-700">
        Data Policy
      </Link>

      {view === 'done' ? (
        <p role="status" className="text-sm text-gray-700">
          Your history has been deleted.
        </p>
      ) : view === 'idle' ? (
        <Button type="button" variant="outline" onClick={openConfirmation} className="self-start">
          Delete my history
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            This will permanently delete all your uploaded images and critique history. This cannot
            be undone.
          </p>
          {view === 'failed' && (
            <Alert>
              <AlertDescription>Could not delete your history — please try again.</AlertDescription>
            </Alert>
          )}
          <label htmlFor="delete-confirm-input" className="text-sm font-medium text-gray-900">
            Type the word DELETE to confirm
          </label>
          <input
            id="delete-confirm-input"
            type="text"
            value={confirmText}
            disabled={view === 'deleting'}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="default"
              disabled={confirmText !== CONFIRMATION_WORD || view === 'deleting'}
              onClick={() => void onConfirmDelete()}
            >
              {view === 'deleting' ? 'Deleting…' : 'Delete permanently'}
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={view === 'deleting'}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
