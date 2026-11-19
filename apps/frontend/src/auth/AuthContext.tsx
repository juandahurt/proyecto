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
import { createApiClient, type ApiClient } from '../api/client';
import { getOnboarding } from '../api/endpoints';
import { clearToken, readToken, saveToken } from './token-store';

export type OnboardingState = 'idle' | 'loading' | 'incomplete' | 'complete' | 'error';

export interface AuthContextValue {
  token: string | null;
  api: ApiClient;
  onboarding: OnboardingState;
  signIn: (token: string) => void;
  logout: () => void;
  loadOnboarding: () => void;
  markOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [onboarding, setOnboarding] = useState<OnboardingState>('idle');
  const tokenRef = useRef<string | null>(token);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const logout = useCallback(() => {
    clearToken();
    tokenRef.current = null;
    generation.current += 1;
    inFlight.current = false;
    setToken(null);
    setOnboarding('idle');
  }, []);

  const signIn = useCallback((next: string) => {
    saveToken(next);
    tokenRef.current = next;
    generation.current += 1;
    inFlight.current = false;
    setToken(next);
    setOnboarding('idle');
  }, []);

  const api = useMemo(
    () => createApiClient({ getToken: () => tokenRef.current, onUnauthorized: logout }),
    [logout]
  );

  const loadOnboarding = useCallback(() => {
    if (!tokenRef.current || inFlight.current) return;
    inFlight.current = true;
    const mine = generation.current;
    setOnboarding('loading');
    void getOnboarding(api).then((out) => {
      if (mine !== generation.current) return; // sesión cambiada o cerrada entretanto
      inFlight.current = false;
      if (out.ok) setOnboarding(out.completed ? 'complete' : 'incomplete');
      else setOnboarding('error');
    });
  }, [api]);

  const markOnboardingComplete = useCallback(() => setOnboarding('complete'), []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, api, onboarding, signIn, logout, loadOnboarding, markOnboardingComplete }),
    [token, api, onboarding, signIn, logout, loadOnboarding, markOnboardingComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Devuelve el estado de onboarding y lo pide una vez si hay sesión y aún no se conoce. */
export function useOnboardingStatus(): OnboardingState {
  const { token, onboarding, loadOnboarding } = useAuth();
  useEffect(() => {
    if (token && onboarding === 'idle') loadOnboarding();
  }, [token, onboarding, loadOnboarding]);
  return onboarding;
}
