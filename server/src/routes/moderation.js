const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireRole, requireModeratorOrAdmin } = require('../middleware/requireRole');
const {
  getConceptQueue,
  getVariantQueue,
  getStats,
  getLog,
} = require('../controllers/moderationController');

const router = Router();

router.use(verifyToken);

router.get('/concepts/queue', requireModeratorOrAdmin, getConceptQueue);
router.get('/variants/queue', requireModeratorOrAdmin, getVariantQueue);
router.get('/stats', requireModeratorOrAdmin, getStats);
router.get('/log', requireRole('admin'), getLog);

module.exports = router;
