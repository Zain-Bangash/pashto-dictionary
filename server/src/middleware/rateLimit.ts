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

export { authLimiter, suggestionLimiter };
