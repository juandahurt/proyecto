/**
 * Augmentación de tipos sobre Express.Request para añadir `req.user`.
 * Se importa como side-effect desde el barrel (index.ts) para que
 * cualquier consumidor tipado obtenga el tipo sin importar este módulo
 * explícitamente.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Payload del JWT verificado. Presente sólo cuando requireAuth tuvo éxito. */
      user?: { userId: string };
    }
  }
}

export {};
