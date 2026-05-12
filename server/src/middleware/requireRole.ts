import { Request, Response, NextFunction } from 'express';

function requireRole(role: 'user' | 'moderator' | 'admin') {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' },
      });
      return;
    }
    next();
  };
}

function requireModeratorOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['moderator', 'admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    return;
  }
  next();
}

export { requireRole, requireModeratorOrAdmin };
