import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

export const TEST_SECRET = 'a-test-secret-for-tests-only';

export function makeJwt(userId = 'user-test-abc-123', opts: jwt.SignOptions = {}): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d', ...opts });
}

export interface Recorded {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

export interface FakeIngestion {
  url: string;
  requests: Recorded[];
  /** Fija la respuesta del siguiente(s) caso. */
  respond: (
    status: number,
    body: string,
    delayMs?: number,
    headers?: Record<string, string>
  ) => void;
  close: () => Promise<void>;
}

/** Servidor HTTP real local en puerto efimero que hace de ingestion. */
export async function startFakeIngestion(): Promise<FakeIngestion> {
  const requests: Recorded[] = [];
  let status = 200;
  let body = '';
  let delay = 0;
  let extraHeaders: Record<string, string> = {};
  const timers = new Set<NodeJS.Timeout>();

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      const send = (): void => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
        res.end(body);
      };
      if (delay > 0) {
        const t = setTimeout(send, delay);
        timers.add(t);
      } else {
        send();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    respond: (s, b, d = 0, h = {}) => {
      status = s;
      body = b;
      delay = d;
      extraHeaders = h;
    },
    close: () =>
      new Promise<void>((resolve) => {
        timers.forEach(clearTimeout);
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Devuelve una URL a un puerto cerrado (se abre y se cierra un servidor). */
export async function closedPortUrl(): Promise<string> {
  const s = http.createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const port = (s.address() as AddressInfo).port;
  await new Promise<void>((r) => s.close(() => r()));
  return `http://127.0.0.1:${port}`;
}

export const ID_1 = '11111111-1111-4111-8111-111111111111';
export const ID_2 = '22222222-2222-4222-8222-222222222222';
export const ID_3 = '33333333-3333-4333-8333-333333333333';

export function readyItem(uploadId: string, timestamp: string): Record<string, unknown> {
  return {
    uploadId,
    status: 'ready',
    confidence: 'HIGH',
    timestamp,
    scores: [1, 2, 3, 4, 5].map((n) => ({ categoryId: `CAT-${n}`, score: n * 10 })),
  };
}

export function lowItem(uploadId: string, timestamp: string): Record<string, unknown> {
  return {
    uploadId,
    status: 'low_confidence',
    confidence: 'LOW',
    timestamp,
    scores: [],
    fallbackReason: 'low_confidence_flag',
  };
}

export function listBody(items: unknown[]): string {
  return JSON.stringify({ data: { items }, error: null, status: 200 });
}
