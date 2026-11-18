import crypto from 'crypto';
import {
  THUMBNAIL_TTL_SECONDS,
  signThumbnailUrl,
  verifyThumbnailSignature,
} from '../service/thumbnail-url';

const KEY = 'test-only-signing-key-0123456789abcdef';
const OTHER_KEY = 'test-only-other-key-fedcba9876543210ab';
const ID = '123e4567-e89b-42d3-a456-426614174000';
const OTHER_ID = '123e4567-e89b-42d3-a456-426614174999';
const NOW = 1_700_000_000_000;
const NOW_S = NOW / 1000;

function parts(url: string) {
  const m = /^\/api\/uploads\/([^/]+)\/thumbnail\?exp=(\d+)&sig=([0-9a-f]{64})$/.exec(url);
  expect(m).not.toBeNull();
  return { id: m![1], exp: m![2], sig: m![3] };
}

describe('signThumbnailUrl', () => {
  it('TTL es 900 s', () => {
    expect(THUMBNAIL_TTL_SECONDS).toBe(900);
  });

  it('forma de ruta relativa y exp = floor(nowMs/1000) + 900', () => {
    const p = parts(signThumbnailUrl({ uploadId: ID, key: KEY, nowMs: NOW + 999 }));
    expect(p.id).toBe(ID);
    expect(Number(p.exp)).toBe(NOW_S + 900);
  });

  it('sig es HMAC-SHA256 hex de thumbnail:<id>:<exp>', () => {
    const p = parts(signThumbnailUrl({ uploadId: ID, key: KEY, nowMs: NOW }));
    const expected = crypto
      .createHmac('sha256', KEY)
      .update(`thumbnail:${ID}:${p.exp}`)
      .digest('hex');
    expect(p.sig).toBe(expected);
  });
});

describe('verifyThumbnailSignature', () => {
  // Sin aserciones en el cuerpo del describe: una firma incorrecta falla por aserción en cada test.
  const url = signThumbnailUrl({ uploadId: ID, key: KEY, nowMs: NOW });
  const m = /exp=(\d+)&sig=([0-9a-f]{64})$/.exec(url);
  const p = { exp: m ? m[1] : '0', sig: m ? m[2] : '0'.repeat(64) };
  const base = { uploadId: ID, exp: p.exp, sig: p.sig, key: KEY, nowMs: NOW };

  it('verify rechaza una firma alterada y acepta la válida', () => {
    expect(m).not.toBeNull();
    expect(verifyThumbnailSignature(base)).toBe(true);
    const bad = p.sig.slice(0, 63) + (p.sig.endsWith('0') ? '1' : '0');
    expect(verifyThumbnailSignature({ ...base, sig: bad })).toBe(false);
  });

  it('rechaza uploadId alterado, exp alterado, otra clave', () => {
    expect(verifyThumbnailSignature({ ...base, uploadId: OTHER_ID })).toBe(false);
    expect(verifyThumbnailSignature({ ...base, exp: String(Number(p.exp) + 1) })).toBe(false);
    expect(verifyThumbnailSignature({ ...base, key: OTHER_KEY })).toBe(false);
  });

  it('firma de otro uploadId con el mismo exp es inválida', () => {
    const other = parts(signThumbnailUrl({ uploadId: OTHER_ID, key: KEY, nowMs: NOW }));
    expect(m).not.toBeNull();
    expect(other.exp).toBe(p.exp);
    expect(verifyThumbnailSignature({ ...base, sig: other.sig })).toBe(false);
  });

  it.each([
    ['sig corta', p.sig.slice(0, 63)],
    ['sig larga', p.sig + '0'],
    ['sig vacía', ''],
    ['sig no hex', 'z'.repeat(64)],
    ['sig con espacios', ' ' + p.sig.slice(1)],
  ])('sig inválida (%s) → false sin lanzar', (_n, sig) => {
    expect(verifyThumbnailSignature({ ...base, sig })).toBe(false);
  });

  // La sig se calcula DE VERDAD sobre los valores raros (misma cadena que firma el módulo):
  // así solo la validación de formato puede rechazarlos, no una discrepancia de firma.
  const signedFor = (uploadId: string, exp: string) =>
    crypto.createHmac('sha256', KEY).update(`thumbnail:${uploadId}:${exp}`).digest('hex');

  it('sanidad: la sig calculada por el test coincide con la del módulo (verify la acepta)', () => {
    expect(verifyThumbnailSignature({ ...base, sig: signedFor(ID, p.exp) })).toBe(true);
  });

  // Varios valores, con firma válida, serían aceptados por Number() si faltara EXP_RE (y futuros).
  it.each([
    ['abc'],
    ['-5'],
    ['1e9'],
    ['17000009e2'],
    ['1.7000009e9'],
    [' 1700000900'],
    ['1700000900 '],
    ['+1700000900'],
    ['1700000900.5'],
    [''],
    ['0'],
  ])('exp inválido %p con sig realmente firmada → false sin lanzar', (exp) => {
    expect(verifyThumbnailSignature({ ...base, exp, sig: signedFor(ID, exp) })).toBe(false);
  });

  it.each([['abc'], ['../etc/passwd'], [''], [ID.toUpperCase() + 'x'], [ID + ' '], [' ' + ID]])(
    'uploadId no UUID %p con sig realmente firmada → false sin lanzar',
    (uploadId) => {
      expect(verifyThumbnailSignature({ ...base, uploadId, sig: signedFor(uploadId, p.exp) })).toBe(
        false
      );
    }
  );

  it('sig en mayúsculas, realmente firmada → false (una sola codificación válida por URL)', () => {
    const lower = signedFor(ID, p.exp);
    expect(verifyThumbnailSignature({ ...base, sig: lower })).toBe(true);
    expect(verifyThumbnailSignature({ ...base, sig: lower.toUpperCase() })).toBe(false);
  });

  it('frontera de expiración: válida en exp-1, inválida en exp y exp+1', () => {
    const expMs = Number(p.exp) * 1000;
    expect(verifyThumbnailSignature({ ...base, nowMs: expMs - 1000 })).toBe(true);
    expect(verifyThumbnailSignature({ ...base, nowMs: expMs - 1 })).toBe(true);
    expect(verifyThumbnailSignature({ ...base, nowMs: expMs })).toBe(false);
    expect(verifyThumbnailSignature({ ...base, nowMs: expMs + 1000 })).toBe(false);
  });

  it('tipos inesperados no lanzan', () => {
    expect(() =>
      verifyThumbnailSignature({
        uploadId: undefined as never,
        exp: undefined as never,
        sig: undefined as never,
        key: KEY,
        nowMs: NOW,
      })
    ).not.toThrow();
    expect(
      verifyThumbnailSignature({
        uploadId: undefined as never,
        exp: undefined as never,
        sig: undefined as never,
        key: KEY,
        nowMs: NOW,
      })
    ).toBe(false);
  });
});
