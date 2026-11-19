import type {
  LimitsResponse,
  UploadDetail,
  UploadListItem,
  UploadResult,
} from '@proyecto/shared-types';
import type { ApiClient, ApiErrorKind } from './client';

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

const NEUTRAL = { ok: false, status: 0, kind: 'network', data: null } as const;

// Cuerpo neutro (rojo primero): la implementación llega en el commit siguiente.
export async function uploadImage(_client: ApiClient, _file: File): Promise<Outcome<UploadData>> {
  return NEUTRAL;
}

export async function getUpload(
  _client: ApiClient,
  _uploadId: string
): Promise<Outcome<UploadDetailData>> {
  return NEUTRAL;
}

export async function listUploads(_client: ApiClient): Promise<Outcome<UploadListItem[]>> {
  return NEUTRAL;
}

export async function getLimits(_client: ApiClient): Promise<Outcome<LimitsData>> {
  return NEUTRAL;
}
