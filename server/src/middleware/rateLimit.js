const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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

module.exports = { authLimiter };
