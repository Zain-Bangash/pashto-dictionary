import { Router } from 'express';
import { body, query } from 'express-validator';
import { verifyToken, optionalVerifyToken } from '../middleware/auth';
import { requireModeratorOrAdmin, requireRole } from '../middleware/requireRole';
import {
  getWanted,
  createConcept,
  listConcepts,
  getConcept,
  suggestConcepts,
  searchConcepts,
  transitionConceptStatus,
  getMyConceptSubmissions,
  getWotd,
  deleteConcept,
  editConcept,
  mergeConcepts,
  updateConcept,
} from '../controllers/conceptController';
import { activeLookup, lookupFormat, isAllowedLookup, invalidLookupMessage } from '../utils/lookups';
import { rejectInvalid } from '../utils/sendValidationError';

const router = Router();

const extraFormat = body('extra').optional().isObject().withMessage('extra must be an object');

const createValidators = [
  body('englishGloss').trim().notEmpty().withMessage('englishGloss is required'),
  activeLookup('partOfSpeech', 'partOfSpeech'),
  extraFormat,
];

const statusValidators = [
  body('status')
    .isIn(['approved', 'rejected', 'published'])
    .withMessage('status must be approved, rejected, or published'),
];

const updateValidators = [
  body('englishGloss').optional().trim().notEmpty().withMessage('englishGloss cannot be empty'),
  lookupFormat('partOfSpeech', true),
  extraFormat,
];

const editValidators = [
  body('englishGloss').optional().trim().notEmpty().withMessage('englishGloss cannot be empty'),
  lookupFormat('partOfSpeech', true),
  extraFormat,
];

const wantedValidators = [
  query('region').isString().withMessage('region is required').trim().notEmpty().withMessage('region is required')
    .isLength({ max: 50 }).withMessage('Invalid region')
    .custom(async (value: string) => {
      if (!(await isAllowedLookup('region', value))) throw new Error(invalidLookupMessage('region'));
      return true;
    }),
  query('q').optional().isString().trim().isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
];

// static paths must come before /:id
router.get('/wotd',           getWotd);
router.get('/wanted',         wantedValidators, rejectInvalid, getWanted);
router.get('/suggest',        suggestConcepts);
router.get('/search',         searchConcepts);
router.get('/my-submissions', verifyToken, getMyConceptSubmissions);
router.get('/',               optionalVerifyToken, listConcepts);
router.get('/:id',            getConcept);
router.post('/', verifyToken, createValidators, createConcept);
router.patch('/:id', verifyToken, updateValidators, updateConcept);
router.patch('/:id/status', verifyToken, requireModeratorOrAdmin, statusValidators, transitionConceptStatus);
router.patch('/:id/edit', verifyToken, requireModeratorOrAdmin, editValidators, editConcept);
router.post('/:sourceId/merge', verifyToken, requireModeratorOrAdmin, mergeConcepts);
router.delete('/:id', verifyToken, requireRole('admin'), deleteConcept);

export = router;
