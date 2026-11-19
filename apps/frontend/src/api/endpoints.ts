import {
  AuthResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@proyecto/shared-types';
import type { ApiClient, ApiErrorKind, ApiResult } from './client';

export interface AuthOutcome {
  ok: boolean;
  token: string | null;
  status: number;
  kind: ApiErrorKind;
}

export interface OnboardingOutcome {
  ok: boolean;
  completed: boolean | null;
  status: number;
  kind: ApiErrorKind;
}

function toAuthOutcome(res: ApiResult): AuthOutcome {
  if (!res.ok) return { ok: false, token: null, status: res.status, kind: res.kind };
  const parsed = AuthResponseSchema.safeParse(res.data);
  if (!parsed.success) return { ok: false, token: null, status: res.status, kind: 'server' };
  return { ok: true, token: parsed.data.data.token, status: res.status, kind: 'none' };
}

export async function loginRequest(client: ApiClient, body: LoginRequest): Promise<AuthOutcome> {
  const { email, password } = body;
  return toAuthOutcome(
    await client.request('POST', '/api/auth/login', { body: { email, password }, auth: false })
  );
}

export async function registerRequest(
  client: ApiClient,
  body: RegisterRequest
): Promise<AuthOutcome> {
  const { email, password } = body;
  return toAuthOutcome(
    await client.request('POST', '/api/auth/register', { body: { email, password }, auth: false })
  );
}

function readCompleted(data: unknown): boolean | null {
  if (data === null || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  // Forma real de trust: { data: { completed }, error, status }. El contrato la describe plana.
  const inner =
    root.data !== null && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;
  return typeof inner.completed === 'boolean' ? inner.completed : null;
}

export async function getOnboarding(client: ApiClient): Promise<OnboardingOutcome> {
  const res = await client.request('GET', '/api/onboarding');
  if (!res.ok) return { ok: false, completed: null, status: res.status, kind: res.kind };
  const completed = readCompleted(res.data);
  if (completed === null) return { ok: false, completed: null, status: res.status, kind: 'server' };
  return { ok: true, completed, status: res.status, kind: 'none' };
}

/** Acepta 200 (forma real de trust) y 204 (forma del contrato). */
export async function ackOnboarding(client: ApiClient): Promise<OnboardingOutcome> {
  const res = await client.request('POST', '/api/onboarding', {
    body: { checkbox1: true, checkbox2: true, checkbox3: true },
  });
  if (!res.ok) return { ok: false, completed: null, status: res.status, kind: res.kind };
  return { ok: true, completed: true, status: res.status, kind: 'none' };
}
