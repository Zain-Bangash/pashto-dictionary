import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'No token provided' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: decoded.id as string, role: decoded.role as 'user' | 'moderator' | 'admin' };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}

// Populates req.user if a valid Bearer token is present, but does not block
// unauthenticated requests. Used on routes that are public by default but grant
// additional access to authenticated roles (e.g. GET /api/variants/:id).
function optionalVerifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    req.user = { id: decoded.id as string, role: decoded.role as 'user' | 'moderator' | 'admin' };
  } catch {
    // Invalid/expired token on a public route — treat as unauthenticated, not an error
  }
  next();
}

export { verifyToken, optionalVerifyToken };
