function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' },
      });
    }
    next();
  };
}

function requireModeratorOrAdmin(req, res, next) {
  if (!req.user || !['moderator', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }
  next();
}

module.exports = { requireRole, requireModeratorOrAdmin };
