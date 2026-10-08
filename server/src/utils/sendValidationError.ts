import { validationResult } from 'express-validator';
import { Request, Response } from 'express';

export function sendValidationError(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  const first = errors.array()[0];
  res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
  return true;
}
