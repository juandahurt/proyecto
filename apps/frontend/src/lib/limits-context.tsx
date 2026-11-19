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
import { getLimits, type LimitsData } from '../api/uploads';
import { useAuth } from '../auth/AuthContext';

export type LimitsStatus = 'loading' | 'ready' | 'unavailable';

export interface LimitsContextValue {
  limits: LimitsData | null;
  status: LimitsStatus;
  /** Vuelve a leer `limits`; si ya hay una lectura en vuelo, la reutiliza. */
  refresh: () => Promise<void>;
}

const LimitsContext = createContext<LimitsContextValue | null>(null);

/**
 * Comparte el contador de tier entre la barra lateral y la pantalla de subida. Si la lectura
 * falla el estado es `unavailable` y nada se bloquea: la autoridad es el servidor.
 */
export function LimitsProvider({ children }: { children: ReactNode }) {
  const { api } = useAuth();
  const [limits, setLimits] = useState<LimitsData | null>(null);
  const [status, setStatus] = useState<LimitsStatus>('loading');
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const run = getLimits(api).then((out) => {
      inFlight.current = null;
      if (!mounted.current) return;
      if (out.ok && out.data) {
        setLimits(out.data);
        setStatus('ready');
      } else {
        setLimits(null);
        setStatus('unavailable');
      }
    });
    inFlight.current = run;
    return run;
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const value = useMemo(() => ({ limits, status, refresh }), [limits, status, refresh]);
  return <LimitsContext.Provider value={value}>{children}</LimitsContext.Provider>;
}

export function useLimits(): LimitsContextValue {
  const ctx = useContext(LimitsContext);
  if (!ctx) throw new Error('useLimits must be used inside LimitsProvider');
  return ctx;
}
