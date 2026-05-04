const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'No token provided' },
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}

// Populates req.user if a valid Bearer token is present, but does not block
// unauthenticated requests. Used on routes that are public by default but grant
// additional access to authenticated roles (e.g. GET /api/variants/:id).
function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
  next();
}

module.exports = { verifyToken, optionalVerifyToken };
