import { Router } from 'express';
import { query } from 'express-validator';
import { verifyToken } from '../middleware/auth';
import { requireRole, requireModeratorOrAdmin, adminOnlyStatus } from '../middleware/requireRole';
import { loadOwnedSuggestion } from '../middleware/ownership';
import { suggestionLimiter } from '../middleware/rateLimit';
import { rejectInvalid } from '../utils/sendValidationError';
import { idParam, proposalValidators, noteValidator, suggestionStatusValidators } from '../utils/suggestionValidators';
import { resubmitSuggestion, editSuggestion, transitionSuggestion, getMySuggestions } from '../controllers/suggestionController';

const router = Router();

router.use(verifyToken);

const mineValidators = [
  query('scope').optional().isIn(['others', 'all']).withMessage('scope must be others or all'),
  query('status').optional().isIn(['open']).withMessage('status must be open'),
  query('concept').optional().isMongoId().withMessage('Invalid concept id'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

router.get('/mine', mineValidators, rejectInvalid, getMySuggestions);

router.patch('/:id/status', requireModeratorOrAdmin, adminOnlyStatus('published'), suggestionStatusValidators, rejectInvalid, transitionSuggestion);
router.patch('/:id/edit', requireRole('admin'), idParam, noteValidator, ...proposalValidators, rejectInvalid, editSuggestion);
router.patch('/:id', suggestionLimiter, idParam, ...proposalValidators, rejectInvalid, loadOwnedSuggestion, resubmitSuggestion);

export = router;
