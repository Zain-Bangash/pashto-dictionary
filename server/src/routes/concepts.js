const { Router } = require('express');
const { body } = require('express-validator');
const { verifyToken, optionalVerifyToken } = require('../middleware/auth');
const { requireModeratorOrAdmin, requireRole } = require('../middleware/requireRole');
const {
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
} = require('../controllers/conceptController');

const router = Router();

const PART_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

const createValidators = [
  body('englishGloss').trim().notEmpty().withMessage('englishGloss is required'),
  body('partOfSpeech').isIn(PART_OF_SPEECH).withMessage(`partOfSpeech must be one of: ${PART_OF_SPEECH.join(', ')}`),
];

const statusValidators = [
  body('status')
    .isIn(['approved', 'rejected', 'published'])
    .withMessage('status must be approved, rejected, or published'),
];

const updateValidators = [
  body('englishGloss').optional().trim().notEmpty().withMessage('englishGloss cannot be empty'),
  body('partOfSpeech').optional().isIn(PART_OF_SPEECH).withMessage(`partOfSpeech must be one of: ${PART_OF_SPEECH.join(', ')}`),
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
router.patch('/:id/edit', verifyToken, requireModeratorOrAdmin, editConcept);
router.post('/:sourceId/merge', verifyToken, requireModeratorOrAdmin, mergeConcepts);
router.delete('/:id', verifyToken, requireRole('admin'), deleteConcept);

module.exports = router;
