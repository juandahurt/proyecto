import { Request, Response } from 'express';
import { UploadRepository } from '../service/upload-repository';
import { readBlob } from '../service/blob-store';
import { verifyThumbnailSignature } from '../service/thumbnail-url';

export interface ThumbnailHandlerDeps {
  repo: UploadRepository;
  signingKey: string;
  /** Reloj en ms epoch. */
  now: () => number;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * GET /api/uploads/:uploadId/thumbnail?exp=&sig= — sirve el blob original (sin JWT).
 *
 * Orden fijo: 1) firma (403 único, sin tocar la BD); 2) fila (404); 3) blob (404 ENOENT / 500);
 * 4) 200 con bytes. Los logs llevan solo uploadId y un motivo genérico: nunca sig, URL ni clave.
 */
export function createThumbnailHandler({ repo, signingKey, now }: ThumbnailHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    const uploadId = String(req.params.uploadId);
    const valid = verifyThumbnailSignature({
      uploadId,
      exp: str(req.query.exp),
      sig: str(req.query.sig),
      key: signingKey,
      nowMs: now(),
    });
    if (!valid) {
      res.status(403).json({ data: null, error: 'Forbidden', status: 403 });
      return;
    }

    const record = repo.findById(uploadId);
    if (!record) {
      res.status(404).json({ data: null, error: 'Not Found', status: 404 });
      return;
    }

    let bytes: Buffer;
    try {
      bytes = await readBlob(record.storedFilename);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ data: null, error: 'Not Found', status: 404 });
        return;
      }
      console.error(`[thumbnail] failed to read blob uploadId=${uploadId}`);
      res.status(500).json({ data: null, error: 'Failed to read file', status: 500 });
      return;
    }

    res.status(200);
    res.set({
      // MIME detectado por el servidor por magic-number en la subida, nunca el del cliente
      'Content-Type': record.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    res.send(bytes);
  };
}
