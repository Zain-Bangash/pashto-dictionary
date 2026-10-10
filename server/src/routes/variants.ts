import { Router } from 'express';
import { body, query } from 'express-validator';
import { verifyToken, optionalVerifyToken } from '../middleware/auth';
import { requireModeratorOrAdmin, requireRole } from '../middleware/requireRole';
import { activeLookup, lookupFormat } from '../utils/lookups';
import { formsValidators } from '../utils/variantForms';
import {
  createVariant,
  listVariants,
  getVariant,
  updateVariant,
  transitionVariantStatus,
  searchVariants,
  getMyVariantSubmissions,
  deleteVariant,
  editVariant,
  crossConceptCheck,
} from '../controllers/variantController';
import { createSuggestion } from '../controllers/suggestionController';
import { uploadClip } from '../controllers/audioController';
import { rawAudio } from '../middleware/rawAudio';
import { SLOT_PATTERN } from '../utils/audioSlots';
import { suggestionLimiter, audioLimiter } from '../middleware/rateLimit';
import { rejectInvalid } from '../utils/sendValidationError';
import { idParam, proposalValidators } from '../utils/suggestionValidators';
import { MISSING_PATTERN } from '../utils/blankFields';

const router = Router();

const extraFormat = body('extra').optional().isObject().withMessage('extra must be an object');

const createValidators = [
  body('conceptId').trim().notEmpty().withMessage('conceptId is required'),
  body('pashto').trim().notEmpty().withMessage('pashto is required'),
  activeLookup('region', 'region'),
  body('definition').trim().notEmpty().withMessage('definition is required'),
  body('submissionNote').optional().isString().trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
  extraFormat,
  ...formsValidators,
];

const updateValidators = [
  lookupFormat('region', true),
  body('submissionNote').optional().isString().trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
  extraFormat,
  ...formsValidators,
];

const editValidators = [lookupFormat('region', true), extraFormat, ...formsValidators];

const statusValidators = [
  body('status')
    .isIn(['approved', 'rejected', 'published'])
    .withMessage('status must be approved, rejected, or published'),
];

const mySubmissionsValidators = [
  query('needs').optional().isIn(['completion']).withMessage('needs must be completion'),
  query('missing').optional().matches(MISSING_PATTERN).withMessage('Invalid missing filter'),
  query('region').optional().isString().trim().isLength({ max: 50 }).withMessage('Invalid region'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

const crossConceptCheckValidators = [
  query('pashto').notEmpty().withMessage('pashto is required'),
  query('conceptId').isMongoId().withMessage('conceptId must be a valid MongoDB ObjectId'),
];

const audioValidators = [
  idParam,
  query('slot').isString().matches(SLOT_PATTERN).withMessage('Invalid recording slot'),
];

// static paths must come before /:id
router.get('/search', searchVariants);
router.get('/my-submissions', verifyToken, mySubmissionsValidators, rejectInvalid, getMyVariantSubmissions);
router.get('/cross-concept-check', verifyToken, crossConceptCheckValidators, crossConceptCheck);
router.get('/', verifyToken, requireModeratorOrAdmin, listVariants);
router.get('/:id', optionalVerifyToken, getVariant);
router.post('/', verifyToken, createValidators, createVariant);
router.post('/:id/suggestions', verifyToken, suggestionLimiter, idParam, ...proposalValidators, rejectInvalid, createSuggestion);
router.post('/:id/audio', verifyToken, audioLimiter, audioValidators, rejectInvalid, rawAudio, uploadClip);
router.patch('/:id/edit', verifyToken, requireRole('admin'), editValidators, editVariant);
router.patch('/:id/status', verifyToken, requireModeratorOrAdmin, statusValidators, transitionVariantStatus);
router.patch('/:id', verifyToken, updateValidators, updateVariant);
router.delete('/:id', verifyToken, requireRole('admin'), deleteVariant);

export = router;
