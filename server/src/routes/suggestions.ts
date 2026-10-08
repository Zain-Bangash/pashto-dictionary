import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireModeratorOrAdmin, adminOnlyStatus } from '../middleware/requireRole';
import { loadOwnedSuggestion } from '../middleware/ownership';
import { suggestionLimiter } from '../middleware/rateLimit';
import { rejectInvalid } from '../utils/sendValidationError';
import { idParam, proposalValidators, noteValidator, suggestionStatusValidators } from '../utils/suggestionValidators';
import { resubmitSuggestion, editSuggestion, transitionSuggestion } from '../controllers/suggestionController';

const router = Router();

router.use(verifyToken);

router.patch('/:id/status', requireModeratorOrAdmin, adminOnlyStatus('published'), suggestionStatusValidators, rejectInvalid, transitionSuggestion);
router.patch('/:id/edit', requireModeratorOrAdmin, idParam, noteValidator, ...proposalValidators, rejectInvalid, editSuggestion);
router.patch('/:id', suggestionLimiter, idParam, ...proposalValidators, rejectInvalid, loadOwnedSuggestion, resubmitSuggestion);

export = router;
