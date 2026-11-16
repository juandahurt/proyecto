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
