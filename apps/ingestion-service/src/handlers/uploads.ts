import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { ClaudeVisionResponse, UploadResult } from '@proyecto/shared-types';
import { detectImageKind, kindToExtension, kindToMimeType } from '../service/magic-number';
import { writeBlob } from '../service/blob-store';
import { UploadRepository } from '../service/upload-repository';
import { resolveCritique, CritiqueOutcome } from '../service/critique-outcome';

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
  /** Cliente Claude Vision inyectable. En tests se inyecta un stub. En producción, callClaudeVision. */
  claudeClient: (buf: Buffer) => Promise<ClaudeVisionResponse>;
}

/**
 * Crea el router de uploads.
 *
 * POST /api/uploads — sube una imagen autenticada y devuelve la crítica categorizada.
 *   - Requiere JWT válido (requireAuth inyectado en server.ts)
 *   - Acepta multipart/form-data, campo 'file', JPEG/PNG/WebP
 *   - Valida tamaño ≤ 10 MiB (multer + guard explícito)
 *   - Valida magic-number (NO Content-Type del cliente)
 *   - Genera stored_filename server-side con randomUUID() + extensión real
 *   - Escribe blob a BLOB_DIR, luego inserta en BD
 *   - Llama al cliente Claude Vision (stub o real) para obtener la crítica
 *   - Responde 202 { data: { uploadId, status:"ready", confidence, categories }, error: null, status: 202 }
 *   - Fallback (LOW, schema inválido, timeout/red): 202 con status "low_confidence", confidence "LOW",
 *     fallbackReason y SIN categories
 */
export function createUploadsRouter({ repo, claudeClient }: UploadsRouterDeps): Router {
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

      // Llamar al cliente Claude Vision (stub o real) y clasificar el resultado (u3)
      let outcome: CritiqueOutcome;
      try {
        outcome = await resolveCritique(claudeClient, buffer);
      } catch {
        // Error que no es AnthropicIntegrationError: bug, no baja confianza -> 500
        res.status(500).json({
          data: null,
          error: 'Failed to analyze image',
          status: 500,
        });
        return;
      }

      if (outcome.kind === 'fallback') {
        // Solo uploadId y reason: nunca buffer, API key ni texto crudo de Claude
        console.warn(
          `[uploads] low_confidence uploadId=${uploadRecord.uploadId} reason=${outcome.reason}`
        );
        // satisfies: tsc comprueba los literales contra el contrato C1 (UploadResult)
        const body = {
          data: {
            uploadId: uploadRecord.uploadId,
            status: 'low_confidence',
            confidence: 'LOW',
            fallbackReason: outcome.reason,
          },
          error: null,
          status: 202,
        } satisfies UploadResult;
        res.status(202).json(body);
        return;
      }

      const critique = outcome.critique;

      // Mapear las categorías de ClaudeVisionResponse al shape de CategoryCritique del contrato C1
      const categories = critique.categories.map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        score: cat.score,
        feedback: cat.feedback,
      }));

      res.status(202).json({
        data: {
          uploadId: uploadRecord.uploadId,
          status: 'ready',
          confidence: critique.confidence,
          categories,
        },
        error: null,
        status: 202,
      });
    }
  );

  return router;
}
