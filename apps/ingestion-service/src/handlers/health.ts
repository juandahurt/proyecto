import { Request, Response } from 'express';

/**
 * GET /health
 * Responde con shape uniforme: { data: { status: "ok" }, error: null, status: 200 }.
 * Mismo shape que identity-service y backend (skeleton).
 */
export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json({
    data: { status: 'ok' },
    error: null,
    status: 200,
  });
}
