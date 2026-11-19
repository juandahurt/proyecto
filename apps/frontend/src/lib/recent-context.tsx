import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { listUploads, type UploadListItem } from '../api/uploads';
import { useAuth } from '../auth/AuthContext';

export type RecentStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface RecentContextValue {
  items: UploadListItem[];
  status: RecentStatus;
  /** Vuelve a leer el listado; si ya hay una lectura en vuelo, la reutiliza. */
  refresh: () => Promise<void>;
}

const RecentContext = createContext<RecentContextValue | null>(null);

/** Vive en el layout para poder recargarse tras una subida aunque la pantalla de subida se desmonte. */
export function RecentProvider({ children }: { children: ReactNode }) {
  const { api } = useAuth();
  const [items, setItems] = useState<UploadListItem[]>([]);
  const [status, setStatus] = useState<RecentStatus>('idle');
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    const run = listUploads(api).then((out) => {
      inFlight.current = null;
      if (!mounted.current) return;
      if (out.ok && out.data) {
        setItems(out.data);
        setStatus('ready');
      } else {
        setItems([]);
        setStatus('unavailable');
      }
    });
    inFlight.current = run;
    return run;
  }, [api]);

  const value = useMemo(() => ({ items, status, refresh }), [items, status, refresh]);
  return <RecentContext.Provider value={value}>{children}</RecentContext.Provider>;
}

export function useRecentUploads(): RecentContextValue {
  const ctx = useContext(RecentContext);
  if (!ctx) throw new Error('useRecentUploads must be used inside RecentProvider');
  return ctx;
}
