import { detectImageKind } from '../service/magic-number';

describe('detectImageKind', () => {
  it('detecta jpeg con firma FF D8 FF E0', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(detectImageKind(buf)).toBe('jpeg');
  });

  it('detecta jpeg con firma FF D8 FF E1 (EXIF)', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40]);
    expect(detectImageKind(buf)).toBe('jpeg');
  });

  it('detecta png con firma completa 89 50 4E 47 0D 0A 1A 0A', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectImageKind(buf)).toBe('png');
  });

  it('detecta webp con RIFF + 4 bytes + WEBP', () => {
    // RIFF (4) + size (4 bytes) + WEBP (4) = 12 bytes mínimo
    const buf = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // size (irrelevante para detección)
      0x57,
      0x45,
      0x42,
      0x50, // WEBP
      0x56,
      0x50,
      0x38,
      0x20, // VP8  (contenido)
    ]);
    expect(detectImageKind(buf)).toBe('webp');
  });

  it('devuelve null para buffer con firma de PDF (25 50 44 46)', () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(detectImageKind(buf)).toBeNull();
  });

  it('devuelve null para buffer vacío (longitud 0) sin lanzar', () => {
    const buf = Buffer.alloc(0);
    expect(() => detectImageKind(buf)).not.toThrow();
    expect(detectImageKind(buf)).toBeNull();
  });

  it('devuelve null para buffer con solo RIFF sin WEBP en 8..11', () => {
    const buf = Buffer.from([
      0x52,
      0x49,
      0x46,
      0x46, // RIFF
      0x00,
      0x00,
      0x00,
      0x00, // size
      0x41,
      0x56,
      0x49,
      0x20, // AVI  (no WEBP)
    ]);
    expect(detectImageKind(buf)).toBeNull();
  });

  it('devuelve null para buffer muy corto (menos de 3 bytes)', () => {
    const buf = Buffer.from([0xff, 0xd8]);
    expect(detectImageKind(buf)).toBeNull();
  });

  it('devuelve null para buffer PNG incompleto (7 bytes, le falta el último byte de firma)', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
    expect(detectImageKind(buf)).toBeNull();
  });
});
