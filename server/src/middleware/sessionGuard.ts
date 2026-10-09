import { Request, Response, NextFunction } from 'express';
import { allowedOrigins } from '../utils/origins';

// CSRF guard for cookie-authenticated routes: HTML forms cannot set custom headers,
// and a cross-origin request carrying one must pass a CORS preflight first.
function requireSameOriginRequest(req: Request, res: Response, next: NextFunction): void {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    res.status(403).json({ success: false, error: { message: 'Missing X-Requested-With header' } });
    return;
  }
  const origin = req.get('Origin');
  if (origin && !allowedOrigins().includes(origin)) {
    res.status(403).json({ success: false, error: { message: 'Origin not allowed' } });
    return;
  }
  next();
}

export { requireSameOriginRequest };
