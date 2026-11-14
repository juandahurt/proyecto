import { Request, Response } from 'express';

/**
 * GET /health
 * Responde con shape uniforme: {data:{status:"ok"},error:null,status:200}.
 */
export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json({
    data: { status: 'ok' },
    error: null,
    status: 200,
  });
}
