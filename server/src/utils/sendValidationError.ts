import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export function sendValidationError(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  const first = errors.array()[0];
  res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
  return true;
}

// Route middleware form: stops the request before any database access
export function rejectInvalid(req: Request, res: Response, next: NextFunction): void {
  if (!sendValidationError(req, res)) next();
}
