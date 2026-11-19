import { Link } from 'react-router-dom';
import { useLimits } from '../lib/limits-context';

/** Contador de tier de la barra lateral (US-9). Si la lectura falla, lo dice y no bloquea nada. */
export function UsageCounter() {
  const { limits, status } = useLimits();
  if (status === 'loading') return null;

  if (limits && limits.tier === 'paid') {
    return <p className="text-sm font-medium text-gray-900">Paid</p>;
  }

  if (
    status === 'ready' &&
    limits &&
    limits.uploadsRemaining !== null &&
    limits.uploadsLimit !== null
  ) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-gray-900">Free</p>
        <p className="text-sm text-gray-600">
          {`${limits.uploadsRemaining} of ${limits.uploadsLimit} uploads left this month`}
        </p>
        <Link to="/upgrade" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <p aria-live="polite" className="text-sm text-gray-500">
      Upload count unavailable
    </p>
  );
}
