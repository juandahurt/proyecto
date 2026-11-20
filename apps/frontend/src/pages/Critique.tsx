import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getUpload, type UploadDetailData } from '../api/uploads';
import { useAuth } from '../auth/AuthContext';
import { ScoreBadge } from '../components/ScoreBadge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { formatDate } from '../lib/format-date';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THUMBNAIL_PREFIX = '/api/uploads/';

type View =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'failed' }
  | { kind: 'loaded'; data: UploadDetailData };

const NOT_FOUND: View = { kind: 'not-found' };

function Thumbnail({ url }: { url: string | undefined }) {
  // Solo rutas relativas firmadas del propio servicio; cualquier otro valor no se pinta.
  if (!url || !url.startsWith(THUMBNAIL_PREFIX)) return null;
  return (
    <img
      src={url}
      alt="Uploaded drawing"
      className="w-[300px] max-w-full rounded-md border border-gray-200"
    />
  );
}

function CritiqueBody({ data }: { data: UploadDetailData }) {
  const categories = [...(data.categories ?? [])].sort((a, b) =>
    a.categoryId.localeCompare(b.categoryId)
  );
  return (
    <section className="flex flex-col gap-6">
      <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
        AI Critique
      </h2>
      {categories.map((c) => (
        <article key={c.categoryId} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {c.categoryName.toUpperCase()}
            </h3>
            <ScoreBadge score={c.score} />
          </div>
          <p className="text-sm text-gray-700">{c.feedback}</p>
        </article>
      ))}
    </section>
  );
}

function LowConfidenceBody({ reason }: { reason: UploadDetailData['fallbackReason'] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
        Critique Unavailable
      </h2>
      {reason === 'timeout' && (
        <p className="text-sm font-medium text-gray-900">Analysis timed out</p>
      )}
      <p className="text-sm text-gray-700">
        Estudio couldn&apos;t generate a reliable critique for this image.
      </p>
      <div>
        <p className="text-sm font-medium text-gray-900">Possible reasons:</p>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          <li>The image may not be a drawing or sketch</li>
          <li>The image resolution is too low</li>
          <li>The content is outside the expected range (abstract art, digital paintings, etc.)</li>
        </ul>
      </div>
      <p className="text-sm text-gray-700">
        This upload counted toward your monthly limit. It will not appear in your trends.
      </p>
      <Button asChild className="self-start">
        <Link to="/upload">Try another image</Link>
      </Button>
    </section>
  );
}

export default function Critique() {
  const { uploadId = '' } = useParams();
  const { api } = useAuth();
  const location = useLocation();
  const valid = UUID.test(uploadId);
  const [loaded, setLoaded] = useState<View>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const view: View = valid ? loaded : NOT_FOUND;
  // Si se llegó navegando desde /history (state.from), «← Back» vuelve ahí; si no, al flujo de subida (u0-T02).
  const backTo =
    (location.state as { from?: string } | null)?.from === 'history' ? '/history' : '/upload';

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    setLoaded({ kind: 'loading' });
    void getUpload(api, uploadId).then((out) => {
      if (cancelled) return;
      if (out.ok && out.data) setLoaded({ kind: 'loaded', data: out.data });
      else if (out.kind === 'unauthorized')
        setLoaded({ kind: 'loading' }); // sesión cerrada
      else if (out.status === 404 || out.status === 403) setLoaded(NOT_FOUND);
      else setLoaded({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [api, uploadId, valid, attempt]);

  // Foco inicial en el encabezado cuando hay contenido que anunciar.
  useEffect(() => {
    if (view.kind !== 'loading') headingRef.current?.focus();
  }, [view.kind]);

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-gray-900 outline-none"
          >
            Critique
          </h1>
          {view.kind === 'loaded' && (
            <p className="text-sm text-gray-600">{formatDate(view.data.timestamp)}</p>
          )}
        </div>
        {view.kind === 'loaded' && (
          <Link to={backTo} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Back
          </Link>
        )}
      </div>

      {view.kind === 'loading' && (
        <div role="status" className="text-sm text-gray-600">
          Loading critique&hellip;
        </div>
      )}

      {view.kind === 'not-found' && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-gray-700">
            We couldn&apos;t find that critique.
          </p>
          <Link to="/upload" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Back to upload
          </Link>
        </div>
      )}

      {view.kind === 'failed' && (
        <div className="flex flex-col items-start gap-3">
          <Alert>
            <AlertDescription>We could not load this critique. Please try again.</AlertDescription>
          </Alert>
          <Button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      {view.kind === 'loaded' && (
        <>
          <Thumbnail url={view.data.thumbnailUrl} />
          {view.data.status === 'low_confidence' ? (
            <LowConfidenceBody reason={view.data.fallbackReason} />
          ) : (
            <CritiqueBody data={view.data} />
          )}
        </>
      )}
    </section>
  );
}
