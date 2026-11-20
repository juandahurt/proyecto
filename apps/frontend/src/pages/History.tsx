import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_NAME_BY_ID } from '@proyecto/shared-types';
import { listUploads, type UploadListItem } from '../api/uploads';
import { useAuth } from '../auth/AuthContext';
import { ScoreBadge } from '../components/ScoreBadge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { formatDate } from '../lib/format-date';

const THUMBNAIL_PREFIX = '/api/uploads/';
const ROWS_BEFORE_SHOW_ALL = 10;
const FOCUS_AREA_TOOLTIP = 'The category with the most room to improve in this upload.';

type View = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; items: UploadListItem[] };

/** La categoría con el score más bajo; empate → categoryId más bajo (orden lexicográfico CAT-1..5). */
function focusArea(scores: UploadListItem['scores']): UploadListItem['scores'][number] | null {
  if (scores.length === 0) return null;
  let best = scores[0];
  for (const s of scores.slice(1)) {
    if (s.score < best.score || (s.score === best.score && s.categoryId < best.categoryId)) {
      best = s;
    }
  }
  return best;
}

function Thumbnail({ url }: { url: string | undefined }) {
  // Solo rutas relativas firmadas del propio servicio; cualquier otro valor no se pinta.
  if (!url || !url.startsWith(THUMBNAIL_PREFIX)) return null;
  return (
    <img
      src={url}
      alt="Uploaded drawing"
      className="h-12 w-12 rounded-md border border-gray-200 object-cover"
    />
  );
}

function HistoryRow({ item }: { item: UploadListItem }) {
  const navigate = useNavigate();
  const area = item.status === 'ready' ? focusArea(item.scores) : null;
  const goToDetail = () => navigate(`/uploads/${item.uploadId}`, { state: { from: 'history' } });
  return (
    <tr
      tabIndex={0}
      role="row"
      className="cursor-pointer border-b border-gray-200 last:border-0 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goToDetail();
      }}
    >
      <td className="py-3 pr-4">
        <Thumbnail url={item.thumbnailUrl} />
      </td>
      <td className="py-3 pr-4 text-sm text-gray-700">{formatDate(item.timestamp)}</td>
      <td className="py-3 pr-4 text-sm text-gray-900">
        {area ? (
          <span title={FOCUS_AREA_TOOLTIP}>
            {CATEGORY_NAME_BY_ID[area.categoryId].toUpperCase()}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="py-3 pr-4">
        {area ? (
          <ScoreBadge score={area.score} />
        ) : (
          <span className="text-sm text-gray-600">Low confidence</span>
        )}
      </td>
    </tr>
  );
}

export default function History() {
  const { api } = useAuth();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setView({ kind: 'loading' });
    void listUploads(api).then((out) => {
      if (cancelled) return;
      if (out.ok && out.data) setView({ kind: 'loaded', items: out.data });
      else if (out.kind !== 'unauthorized') setView({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gray-900">My History</h1>

      {view.kind === 'loading' && (
        <div role="status" className="text-sm text-gray-600">
          Loading&hellip;
        </div>
      )}

      {view.kind === 'failed' && (
        <Alert>
          <AlertDescription>We could not load your history. Please try again.</AlertDescription>
        </Alert>
      )}

      {view.kind === 'loaded' && view.items.length === 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-gray-600">No uploads yet</p>
          <Link to="/upload" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Upload your first drawing
          </Link>
        </div>
      )}

      {view.kind === 'loaded' && view.items.length > 0 && (
        <>
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Image</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Focus area</th>
                <th className="py-2 pr-4">Score</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? view.items : view.items.slice(0, ROWS_BEFORE_SHOW_ALL)).map((item) => (
                <HistoryRow key={item.uploadId} item={item} />
              ))}
            </tbody>
          </table>
          {!showAll && view.items.length > ROWS_BEFORE_SHOW_ALL && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="self-start text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Show all {view.items.length}
            </button>
          )}
        </>
      )}

      <div className="border-t border-gray-200 pt-4">
        <Link to="/trends" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Progress trends
        </Link>
      </div>
    </section>
  );
}
