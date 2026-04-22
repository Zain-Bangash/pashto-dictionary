const { Router } = require('express');
const { body } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const { requireRole, requireModeratorOrAdmin } = require('../middleware/requireRole');
const {
  getQueue,
  approveEntry,
  rejectEntry,
  publishEntry,
  getLog,
} = require('../controllers/moderationController');

const router = Router();

router.use(verifyToken);

router.get('/queue', requireModeratorOrAdmin, getQueue);

router.patch('/:id/approve', requireModeratorOrAdmin, approveEntry);

router.patch(
  '/:id/reject',
  requireModeratorOrAdmin,
  [body('note').trim().notEmpty().withMessage('note is required when rejecting an entry')],
  rejectEntry
);

router.patch('/:id/publish', requireRole('admin'), publishEntry);

router.get('/log', requireRole('admin'), getLog);

module.exports = router;
