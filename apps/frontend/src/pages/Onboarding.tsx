import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ONBOARDING_CHECKBOXES } from '@proyecto/shared-types';
import { ackOnboarding } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { GENERIC_ERROR } from './credentials';

export default function Onboarding() {
  const { api, markOnboardingComplete } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<boolean[]>(() => ONBOARDING_CHECKBOXES.map(() => false));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const allChecked = checked.every(Boolean);

  async function onStart() {
    if (!allChecked || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    const out = await ackOnboarding(api);
    busy.current = false;
    if (out.ok) {
      markOnboardingComplete();
      navigate('/upload', { replace: true });
      return;
    }
    setSubmitting(false);
    if (out.kind === 'unauthorized') return; // el cliente ya cerró la sesión
    setError(
      out.status === 422 ? 'Please confirm all three statements to continue.' : GENERIC_ERROR
    );
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome to Estudio</h1>
          <p className="text-sm text-gray-600">
            Track whether your practice is actually improving.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p id="onboarding-instructions" className="text-sm font-medium text-gray-900">
            Before your first upload, confirm each statement:
          </p>
          {ONBOARDING_CHECKBOXES.map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <Checkbox
                id={`onboarding-checkbox-${i + 1}`}
                ref={i === 0 ? firstRef : undefined}
                checked={checked[i]}
                onCheckedChange={(v) =>
                  setChecked((prev) => prev.map((c, j) => (j === i ? v === true : c)))
                }
              />
              <Label htmlFor={`onboarding-checkbox-${i + 1}`}>{text}</Label>
            </div>
          ))}
          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            type="button"
            disabled={!allChecked || submitting}
            aria-disabled={!allChecked || submitting}
            aria-describedby="onboarding-instructions"
            onClick={onStart}
          >
            Get Started
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
