import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoginRequestSchema } from '@proyecto/shared-types';
import { loginRequest } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GENERIC_ERROR, validateCredentials } from './credentials';

export default function Login() {
  const { api, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    const invalid = validateCredentials(LoginRequestSchema, email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setError(null);
    const out = await loginRequest(api, { email, password });
    busy.current = false;
    if (out.ok && out.token) {
      signIn(out.token);
      return;
    }
    setSubmitting(false);
    setError(out.kind === 'unauthorized' ? 'Incorrect email or password' : GENERIC_ERROR);
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold text-gray-900">Log in</h1>
          <p className="text-sm text-gray-600">Welcome back to Estudio.</p>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-gray-600">
            New to Estudio?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
