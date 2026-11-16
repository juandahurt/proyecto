import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { detectImageKind, kindToExtension, kindToMimeType } from '../service/magic-number';
import { writeBlob } from '../service/blob-store';
import { UploadRepository } from '../service/upload-repository';

/** 10 MiB — coincide con MAX_UPLOAD_BYTES en ConfigMap K8s. */
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10485760);

/**
 * Configura multer con memory storage para que el buffer esté disponible
 * en req.file.buffer para la validación de magic-number.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export interface UploadsRouterDeps {
  repo: UploadRepository;
}

/**
 * Crea el router de uploads.
 *
 * POST /api/uploads — sube una imagen autenticada.
 *   - Requiere JWT válido (requireAuth inyectado en server.ts)
 *   - Acepta multipart/form-data, campo 'file', JPEG/PNG/WebP
 *   - Valida tamaño ≤ 10 MiB (multer + guard explícito)
 *   - Valida magic-number (NO Content-Type del cliente)
 *   - Genera stored_filename server-side con randomUUID() + extensión real
 *   - Escribe blob a BLOB_DIR, luego inserta en BD
 *   - Responde 202 { data: { uploadId }, error: null, status: 202 }
 */
export function createUploadsRouter({ repo }: UploadsRouterDeps): Router {
  const router = Router();

  router.post(
    '/',
    // Multer procesa el multipart y limita el tamaño antes de que el handler lo vea
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({
              data: null,
              error: 'File too large. Maximum upload size is 10 MB.',
              status: 413,
            });
            return;
          }
          // LIMIT_UNEXPECTED_FILE y otros errores de multer → 422
          res.status(422).json({
            data: null,
            error: 'Missing required field: file',
            status: 422,
          });
          return;
        }
        if (err) {
          res.status(500).json({
            data: null,
            error: 'Upload error',
            status: 500,
          });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      // Guard: req.file debe existir (campo 'file' presente en el multipart)
      if (!req.file) {
        res.status(422).json({
          data: null,
          error: 'Missing required field: file',
          status: 422,
        });
        return;
      }

      // Guard adicional: rechazar si el tamaño supera el límite (doble barrera)
      if (req.file.size > MAX_UPLOAD_BYTES) {
        res.status(413).json({
          data: null,
          error: 'File too large. Maximum upload size is 10 MB.',
          status: 413,
        });
        return;
      }

      const buffer = req.file.buffer;

      // Validación por magic-number — NO por Content-Type del cliente
      const kind = detectImageKind(buffer);
      if (kind === null) {
        res.status(422).json({
          data: null,
          error: 'Invalid image format',
          status: 422,
        });
        return;
      }

      // Nombre de archivo generado server-side con UUID + extensión del tipo REAL detectado
      // NUNCA se usa req.file.originalname para el stored_filename
      const ext = kindToExtension(kind);
      const storedFilename = `${crypto.randomUUID()}${ext}`;
      const mimeType = kindToMimeType(kind);

      // Escribir blob al store; si falla, responder 500 sin insertar en BD
      try {
        await writeBlob(storedFilename, buffer);
      } catch {
        res.status(500).json({
          data: null,
          error: 'Failed to store file',
          status: 500,
        });
        return;
      }

      // userId viene del JWT verificado por requireAuth (req.user.userId)
      const userId = req.user!.userId;

      // Insertar registro en BD DESPUÉS de escribir el blob exitosamente
      const uploadRecord = repo.create({
        userId,
        storedFilename,
        mimeType,
        sizeBytes: req.file.size,
      });

      res.status(202).json({
        data: { uploadId: uploadRecord.uploadId },
        error: null,
        status: 202,
      });
    }
  );

  return router;
}
