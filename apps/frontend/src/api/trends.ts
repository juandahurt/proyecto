import {
  SubscribeResponseSchema,
  TrendResponseSchema,
  type SubscribeResponse,
  type TrendResponse,
} from '@proyecto/shared-types';
import type { ApiClient } from './client';
import type { Outcome } from './uploads';

export type TrendsData = TrendResponse['data'];
export type SubscribeData = SubscribeResponse['data'];

interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

function toOutcome<Body, T>(
  res: Awaited<ReturnType<ApiClient['request']>>,
  schema: Parser<Body>,
  pick: (b: Body) => T
): Outcome<T> {
  if (!res.ok) return { ok: false, status: res.status, kind: res.kind, data: null };
  const parsed = schema.safeParse(res.data);
  if (!parsed.success) return { ok: false, status: res.status, kind: 'server', data: null };
  return { ok: true, status: res.status, kind: 'none', data: pick(parsed.data) };
}

export async function getTrends(client: ApiClient): Promise<Outcome<TrendsData>> {
  const res = await client.request('GET', '/api/trends');
  return toOutcome(res, TrendResponseSchema, (b: TrendResponse) => b.data);
}

export async function subscribe(client: ApiClient): Promise<Outcome<SubscribeData>> {
  const res = await client.request('POST', '/api/users/me/subscribe');
  return toOutcome(res, SubscribeResponseSchema, (b: SubscribeResponse) => b.data);
}
