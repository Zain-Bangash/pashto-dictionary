import { Router } from 'express';
import { body, query } from 'express-validator';
import { verifyToken } from '../middleware/auth';
import { requireModeratorOrAdmin, adminOnlyStatus } from '../middleware/requireRole';
import { loadOwnedClip } from '../middleware/ownership';
import { rejectInvalid } from '../utils/sendValidationError';
import { idParam } from '../utils/suggestionValidators';
import { withdrawClip, transitionClip, getMyClips } from '../controllers/audioController';

const router = Router();

router.use(verifyToken);

const pageValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

const statusValidators = [
  idParam,
  body('status').isIn(['approved', 'rejected', 'published']).withMessage('status must be approved, rejected, or published'),
  body('moderatorNote').optional().isString().trim().isLength({ max: 500 }).withMessage('moderatorNote must be 500 characters or fewer'),
];

router.get('/mine', pageValidators, rejectInvalid, getMyClips);
router.patch('/:id/status', requireModeratorOrAdmin, adminOnlyStatus('published'), statusValidators, rejectInvalid, transitionClip);
router.delete('/:id', idParam, rejectInvalid, loadOwnedClip, withdrawClip);

export = router;
