import {
  LimitsResponseSchema,
  UploadDetailSchema,
  UploadListSchema,
  UploadResultSchema,
  type LimitsResponse,
  type UploadDetail,
  type UploadListItem,
  type UploadResult,
} from '@proyecto/shared-types';
import type { ApiClient, ApiErrorKind, ApiResult } from './client';

export type UploadData = UploadResult['data'];
export type UploadDetailData = UploadDetail['data'];
export type LimitsData = LimitsResponse['data'];
export type { UploadListItem };

export interface Outcome<T> {
  ok: boolean;
  status: number;
  kind: ApiErrorKind;
  data: T | null;
}

/** Nombre fijo del archivo en el multipart: el nombre del usuario nunca sale del navegador. */
const SENT_FILENAME = 'upload';

interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/** Valida un `200/202` con un schema de `shared-types`; una forma inesperada es un error del servidor. */
function toOutcome<Body, T>(
  res: ApiResult,
  schema: Parser<Body>,
  pick: (b: Body) => T
): Outcome<T> {
  if (!res.ok) return { ok: false, status: res.status, kind: res.kind, data: null };
  const parsed = schema.safeParse(res.data);
  if (!parsed.success) return { ok: false, status: res.status, kind: 'server', data: null };
  return { ok: true, status: res.status, kind: 'none', data: pick(parsed.data) };
}

export async function uploadImage(client: ApiClient, file: File): Promise<Outcome<UploadData>> {
  const body = new FormData();
  body.append('file', file, SENT_FILENAME);
  const res = await client.request('POST', '/api/uploads', { body });
  return toOutcome(res, UploadResultSchema, (b: UploadResult) => b.data);
}

export async function getUpload(
  client: ApiClient,
  uploadId: string
): Promise<Outcome<UploadDetailData>> {
  const res = await client.request('GET', `/api/uploads/${encodeURIComponent(uploadId)}`);
  return toOutcome(res, UploadDetailSchema, (b: UploadDetail) => b.data);
}

export async function listUploads(client: ApiClient): Promise<Outcome<UploadListItem[]>> {
  const res = await client.request('GET', '/api/uploads');
  return toOutcome(res, UploadListSchema, (b) => b.data.items);
}

export async function getLimits(client: ApiClient): Promise<Outcome<LimitsData>> {
  const res = await client.request('GET', '/api/users/me/limits');
  return toOutcome(res, LimitsResponseSchema, (b: LimitsResponse) => b.data);
}
