import { createContext, useContext, type ReactNode } from 'react';
import type { LimitsData } from '../api/uploads';

export type LimitsStatus = 'loading' | 'ready' | 'unavailable';

export interface LimitsContextValue {
  limits: LimitsData | null;
  status: LimitsStatus;
  refresh: () => Promise<void>;
}

const NEUTRAL: LimitsContextValue = {
  limits: null,
  status: 'loading',
  refresh: async () => undefined,
};

const LimitsContext = createContext<LimitsContextValue>(NEUTRAL);

export function LimitsProvider({ children }: { children: ReactNode }) {
  return <LimitsContext.Provider value={NEUTRAL}>{children}</LimitsContext.Provider>;
}

export function useLimits(): LimitsContextValue {
  return useContext(LimitsContext);
}
