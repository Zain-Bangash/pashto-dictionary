import { Router } from 'express';
import { query } from 'express-validator';
import { rejectInvalid } from '../utils/sendValidationError';
import { verifyToken } from '../middleware/auth';
import { requireRole, requireModeratorOrAdmin } from '../middleware/requireRole';
import {
  getConceptQueue,
  getVariantQueue,
  getGroupedQueue,
  getStats,
  getLog,
} from '../controllers/moderationController';
import { getSuggestionQueue } from '../controllers/suggestionController';

const router = Router();

router.use(verifyToken);

router.get('/concepts/queue', requireModeratorOrAdmin, getConceptQueue);
router.get('/variants/queue', requireModeratorOrAdmin, getVariantQueue);
router.get('/queue', requireModeratorOrAdmin, getGroupedQueue);
const suggestionQueueValidators = [
  query('status').optional().isIn(['pending', 'approved']).withMessage('status must be pending or approved'),
  query('concept').optional().isMongoId().withMessage('Invalid concept id'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

router.get('/suggestions', requireModeratorOrAdmin, suggestionQueueValidators, rejectInvalid, getSuggestionQueue);
router.get('/stats', requireModeratorOrAdmin, getStats);
router.get('/log', requireRole('admin'), getLog);

export = router;
