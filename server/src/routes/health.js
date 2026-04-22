const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date() } });
});

module.exports = router;
