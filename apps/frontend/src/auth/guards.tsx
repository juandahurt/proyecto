import { Navigate, Outlet } from 'react-router-dom';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { useAuth, useOnboardingStatus } from './AuthContext';

export function LoadingScreen() {
  return (
    <div role="status" aria-live="polite" className="p-8 text-sm text-gray-600">
      Loading&hellip;
    </div>
  );
}

function OnboardingLookupFailed() {
  const { loadOnboarding } = useAuth();
  return (
    <div className="mx-auto max-w-md p-8">
      <Alert>
        <AlertDescription>
          We could not load your account status. Please try again.
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={loadOnboarding}>
        Retry
      </Button>
    </div>
  );
}

/** Decide a dónde va un usuario con sesión según su onboarding. */
export function SessionRedirect() {
  const { token } = useAuth();
  const status = useOnboardingStatus();
  if (!token) return <Navigate to="/login" replace />;
  if (status === 'error') return <OnboardingLookupFailed />;
  if (status === 'complete') return <Navigate to="/upload" replace />;
  if (status === 'incomplete') return <Navigate to="/onboarding" replace />;
  return <LoadingScreen />;
}

/** Rutas solo para visitantes (/login, /register): con sesión se redirige. */
export function PublicOnly() {
  const { token } = useAuth();
  return token ? <SessionRedirect /> : <Outlet />;
}

/** Exige sesión; sin token va a /login sin llamar a ninguna API. */
export function RequireSession() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Exige sesión y onboarding completado antes de pintar contenido protegido. */
export function RequireOnboarded() {
  const status = useOnboardingStatus();
  if (status === 'error') return <OnboardingLookupFailed />;
  if (status === 'incomplete') return <Navigate to="/onboarding" replace />;
  if (status === 'complete') return <Outlet />;
  return <LoadingScreen />;
}

/** Ruta /onboarding: solo si aún no se completó. */
export function RequireNotOnboarded() {
  const status = useOnboardingStatus();
  if (status === 'error') return <OnboardingLookupFailed />;
  if (status === 'complete') return <Navigate to="/upload" replace />;
  if (status === 'incomplete') return <Outlet />;
  return <LoadingScreen />;
}
