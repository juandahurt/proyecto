import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { UploadRepository } from '../service/upload-repository';

export interface DeleteUserDataRouterDeps {
  repo: UploadRepository;
}

/**
 * DELETE /api/internal/users/:userId/data — network-trusted (sin JWT, igual
 * que increment-counter). Borra en una transacción todas las filas de
 * category_critiques y uploads del usuario; después, best-effort y fuera de
 * la transacción, borra cada blob correspondiente con fs.promises.unlink,
 * ignorando ENOENT y registrando (sin datos del usuario) cualquier otro error
 * de borrado de archivo sin abortar el resto.
 *
 * Responde 204 si la transacción de BD tuvo éxito (los blobs son limpieza, no
 * afectan el veredicto); 500 solo si la transacción de BD falla. Usuario sin
 * uploads, o userId que no es un UUID real, responden 204 igual: no hay nada
 * que borrar y no es un error (red interna de confianza).
 */
export function createDeleteUserDataRouter({ repo }: DeleteUserDataRouterDeps): Router {
  const router = Router();

  router.delete('/users/:userId/data', async (req: Request, res: Response) => {
    const { userId } = req.params;

    let storedFilenames: string[];
    try {
      storedFilenames = repo.deleteByUserId(userId);
    } catch (_err: unknown) {
      res.status(500).json({ data: null, error: 'internal server error', status: 500 });
      return;
    }

    // Limpieza de blobs: best-effort y fuera de la transacción de BD — un fallo
    // de archivo no afecta el veredicto 204, que ya quedó decidido por la BD.
    const blobDir = process.env.BLOB_DIR ?? path.join(process.cwd(), 'data', 'blobs');
    await Promise.allSettled(
      storedFilenames.map(async (storedFilename) => {
        try {
          await fs.promises.unlink(path.join(blobDir, storedFilename));
        } catch (err: unknown) {
          const code =
            typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
          if (code === 'ENOENT') return;
          console.warn('[delete-user-data] failed to delete a blob during cascade cleanup');
        }
      })
    );

    res.status(204).end();
  });

  return router;
}
