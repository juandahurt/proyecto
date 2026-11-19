import { createContext, useContext, type ReactNode } from 'react';
import type { UploadListItem } from '../api/uploads';

export type RecentStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface RecentContextValue {
  items: UploadListItem[];
  status: RecentStatus;
  refresh: () => Promise<void>;
}

const NEUTRAL: RecentContextValue = { items: [], status: 'idle', refresh: async () => undefined };

const RecentContext = createContext<RecentContextValue>(NEUTRAL);

export function RecentProvider({ children }: { children: ReactNode }) {
  return <RecentContext.Provider value={NEUTRAL}>{children}</RecentContext.Provider>;
}

export function useRecentUploads(): RecentContextValue {
  return useContext(RecentContext);
}
