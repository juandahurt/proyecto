import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImage, type Outcome, type UploadData } from '../api/uploads';
import { useAuth } from '../auth/AuthContext';
import { DropZone, MSG_TOO_LARGE } from '../components/DropZone';
import { RecentUploads } from '../components/RecentUploads';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useLimits } from '../lib/limits-context';
import { useRecentUploads } from '../lib/recent-context';

const MSG_INVALID_IMAGE = "That file doesn't look like a valid image";
const MSG_FAILED = 'Upload failed — please try again';
const MSG_NETWORK = 'Upload failed — check your connection and try again';

function serverMessage(out: Outcome<UploadData>): string {
  if (out.status === 413) return MSG_TOO_LARGE;
  if (out.status === 422) return MSG_INVALID_IMAGE;
  if (out.kind === 'network') return MSG_NETWORK;
  return MSG_FAILED;
}

export default function Upload() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const { limits, refresh: refreshLimits } = useLimits();
  const { refresh: refreshRecent } = useRecentUploads();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  // Al entrar se vuelven a leer el contador y la lista (el layout puede llevar tiempo montado).
  useEffect(() => {
    void refreshLimits();
    void refreshRecent();
  }, [refreshLimits, refreshRecent]);

  async function onFile(file: File) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setUploading(true);
    const out = await uploadImage(api, file);
    busy.current = false;
    if (out.ok && out.data) {
      void refreshLimits({ fresh: true });
      void refreshRecent();
      navigate(`/uploads/${out.data.uploadId}`);
      return;
    }
    setUploading(false);
    if (out.kind === 'unauthorized') return; // el cliente ya cerró la sesión
    setError(serverMessage(out));
  }

  const exhausted = limits?.tier === 'free' && limits.uploadsRemaining === 0;

  return (
    <section className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold text-gray-900">Upload a Drawing</h1>
      {uploading ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white p-10 text-center"
        >
          <div aria-hidden="true" className="h-2 w-48 animate-pulse rounded bg-blue-600" />
          <p className="text-sm text-gray-700">Analyzing your drawing…</p>
        </div>
      ) : exhausted && limits ? (
        <div aria-live="polite">
          <UpgradePrompt uploadsLimit={limits.uploadsLimit} resetDate={limits.resetDate} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <DropZone onFile={(f) => void onFile(f)} onReject={setError} />
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <RecentUploads />
    </section>
  );
}
