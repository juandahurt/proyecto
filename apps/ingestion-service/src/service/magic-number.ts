/**
 * Detección de tipo de imagen por magic-number (primeros bytes del buffer).
 *
 * Opera sobre el buffer de bytes real, NO sobre el Content-Type del cliente.
 * Esta es la capa de seguridad definida en project.md: "ALWAYS validar el
 * magic number (primeros bytes del archivo) en el servidor para confirmar que
 * el archivo subido es realmente una imagen".
 */

/**
 * Detecta el tipo de imagen leyendo los bytes mágicos del buffer.
 *
 * - jpeg: bytes FF D8 FF en posición 0..2
 * - png:  bytes 89 50 4E 47 0D 0A 1A 0A en posición 0..7 (firma PNG estándar)
 * - webp: bytes RIFF (52 49 46 46) en 0..3 Y WEBP (57 45 42 50) en 8..11
 * - null: cualquier otra combinación (incluyendo buffer vacío o muy corto)
 *
 * @param buffer - Buffer de bytes del archivo subido.
 * @returns "jpeg" | "png" | "webp" | null
 */
export function detectImageKind(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF (bytes 0..3) + WEBP (bytes 8..11)
  // Formato: "RIFF" + 4 bytes de tamaño de archivo + "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Mapea el tipo de imagen a su extensión de archivo.
 * La extensión la escoge el servidor; nunca viene del cliente.
 */
export function kindToExtension(kind: 'jpeg' | 'png' | 'webp'): string {
  const map: Record<string, string> = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
  };
  return map[kind];
}

/**
 * Mapea el tipo de imagen a su MIME type canónico.
 */
export function kindToMimeType(kind: 'jpeg' | 'png' | 'webp'): string {
  const map: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return map[kind];
}
