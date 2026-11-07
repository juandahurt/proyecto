import { Request, Response } from 'express';

export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json({
    data: { status: 'ok' },
    error: null,
    status: 200,
  });
}
