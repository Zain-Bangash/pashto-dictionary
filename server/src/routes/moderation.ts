import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireRole, requireModeratorOrAdmin } from '../middleware/requireRole';
import {
  getConceptQueue,
  getVariantQueue,
  getStats,
  getLog,
} from '../controllers/moderationController';

const router = Router();

router.use(verifyToken);

router.get('/concepts/queue', requireModeratorOrAdmin, getConceptQueue);
router.get('/variants/queue', requireModeratorOrAdmin, getVariantQueue);
router.get('/stats', requireModeratorOrAdmin, getStats);
router.get('/log', requireRole('admin'), getLog);

export = router;
