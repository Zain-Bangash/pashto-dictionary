import { Router } from 'express';
import { body } from 'express-validator';
import { verifyToken, optionalVerifyToken } from '../middleware/auth';
import { requireModeratorOrAdmin, requireRole } from '../middleware/requireRole';
import {
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
import { activeLookup, lookupFormat } from '../utils/lookups';

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

// static paths must come before /:id
router.get('/wotd',           getWotd);
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
