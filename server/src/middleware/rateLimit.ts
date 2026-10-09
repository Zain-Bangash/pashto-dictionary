import rateLimit from 'express-rate-limit';

function limiter(max: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.SKIP_RATE_LIMIT === 'true',
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { message: 'Too many requests, please try again later.' },
      });
    },
  });
}

const authLimiter = limiter(10);
const suggestionLimiter = limiter(30);
// Refresh runs on every page load in every tab, so it needs far more headroom than login.
const sessionLimiter = limiter(100);

export { authLimiter, suggestionLimiter, sessionLimiter };
