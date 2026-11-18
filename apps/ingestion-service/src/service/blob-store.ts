import fs from 'fs';
import path from 'path';

/**
 * Escribe el buffer de un blob al directorio de almacenamiento de blobs.
 *
 * BLOB_DIR se lee de process.env.BLOB_DIR o './data/blobs' por defecto.
 * El directorio se crea automáticamente si no existe (mkdir -p).
 *
 * IMPORTANTE: storedFilename es siempre generado por el servidor (UUID + extensión
 * según tipo detectado). NUNCA proviene del request del cliente.
 *
 * @param storedFilename - Nombre del archivo generado por el servidor (uuid.ext).
 * @param buffer - Contenido binario del archivo.
 * @returns La ruta absoluta del archivo escrito.
 */
export async function writeBlob(storedFilename: string, buffer: Buffer): Promise<string> {
  const blobDir = process.env.BLOB_DIR ?? path.join(process.cwd(), 'data', 'blobs');

  // mkdir -p: crea el directorio y sus padres si no existen
  await fs.promises.mkdir(blobDir, { recursive: true });

  const filePath = path.join(blobDir, storedFilename);
  await fs.promises.writeFile(filePath, buffer);

  return filePath;
}

/**
 * Lee un blob de BLOB_DIR (misma resolución que writeBlob).
 *
 * Defensa de ruta: solo acepta nombres simples (sin separadores ni `..`) y comprueba que la ruta
 * resuelta quede dentro de BLOB_DIR. Si el archivo no existe, propaga el error ENOENT original.
 *
 * @throws Error si storedFilename no es un nombre simple o escapa de BLOB_DIR.
 */
export async function readBlob(storedFilename: string): Promise<Buffer> {
  if (
    typeof storedFilename !== 'string' ||
    storedFilename === '' ||
    storedFilename.includes('..') ||
    /[\\/]/.test(storedFilename) ||
    path.basename(storedFilename) !== storedFilename
  ) {
    throw new Error('Invalid blob name');
  }
  const blobDir = path.resolve(process.env.BLOB_DIR ?? path.join(process.cwd(), 'data', 'blobs'));
  const filePath = path.resolve(blobDir, storedFilename);
  if (path.dirname(filePath) !== blobDir) {
    throw new Error('Blob path escapes BLOB_DIR');
  }
  return fs.promises.readFile(filePath);
}
