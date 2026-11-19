export type ApiErrorKind = 'none' | 'unauthorized' | 'client' | 'server' | 'network';

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  kind: ApiErrorKind;
}

export interface ApiClientDeps {
  /** Inyectable para tests; por defecto se usa el `fetch` global en cada llamada. */
  fetchFn?: typeof fetch;
  getToken: () => string | null;
  /** Se invoca ante un 401 de una llamada autenticada (el token ya no vale). */
  onUnauthorized: () => void;
}

export interface RequestOptions {
  body?: unknown;
  /** Por defecto true. Login y registro pasan false: no envían `Authorization`. */
  auth?: boolean;
}

export interface ApiClient {
  request<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    options?: RequestOptions
  ): Promise<ApiResult<T>>;
}

function networkFailure<T>(): ApiResult<T> {
  return { ok: false, status: 0, data: null, error: null, kind: 'network' };
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classify(status: number): ApiErrorKind {
  if (status >= 200 && status < 300) return 'none';
  if (status === 401) return 'unauthorized';
  if (status >= 400 && status < 500) return 'client';
  return 'server';
}

/**
 * Cliente HTTP mínimo. Solo rutas relativas `/api/...` (un único origen detrás de nginx),
 * `Authorization: Bearer` únicamente en llamadas autenticadas, sin cookies, sin seguir
 * redirecciones y sin escribir nunca en la consola.
 */
export function createApiClient(deps: ApiClientDeps): ApiClient {
  return {
    async request<T = unknown>(
      method: 'GET' | 'POST',
      path: string,
      options: RequestOptions = {}
    ): Promise<ApiResult<T>> {
      if (!path.startsWith('/api/')) return networkFailure<T>();
      const auth = options.auth !== false;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (auth) {
        const token = deps.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const init: RequestInit = {
        method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      };
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
      }

      let res: Response;
      let text: string;
      try {
        const doFetch = deps.fetchFn ?? ((u: string, i?: RequestInit) => globalThis.fetch(u, i));
        res = await doFetch(path, init);
        text = await res.text();
      } catch {
        return networkFailure<T>();
      }

      const kind = classify(res.status);
      const parsed = parseBody(text);
      const envelope =
        parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      const error = envelope && typeof envelope.error === 'string' ? envelope.error : null;
      if (kind === 'unauthorized' && auth) deps.onUnauthorized();
      return {
        ok: kind === 'none',
        status: res.status,
        data: (parsed as T | null) ?? null,
        error,
        kind,
      };
    },
  };
}
