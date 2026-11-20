import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format-date';
import { useRecentUploads } from '../lib/recent-context';
import { Badge } from './ui/badge';

const MAX_ROWS = 5;

/** Últimas subidas (2A/2B). Si la lectura falla, no se muestra nada: no bloquea la subida. */
export function RecentUploads() {
  const { items, status } = useRecentUploads();
  if (status !== 'ready') return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-gray-900">Recent uploads</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">No uploads yet</p>
      ) : (
        <ul aria-label="Recent uploads" className="flex flex-col divide-y divide-gray-200">
          {items.slice(0, MAX_ROWS).map((item) => (
            <li key={item.uploadId} className="flex items-center gap-4 py-3">
              <span className="w-28 text-sm text-gray-700">{formatDate(item.timestamp)}</span>
              <Badge
                className={
                  item.status === 'low_confidence'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }
              >
                {item.status === 'low_confidence' ? 'Low confidence' : 'Ready'}
              </Badge>
              <Link
                to={`/uploads/${item.uploadId}`}
                className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
