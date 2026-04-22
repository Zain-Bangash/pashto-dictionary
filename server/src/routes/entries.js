const { Router } = require('express');
const { body } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const {
  listEntries,
  searchEntries,
  getEntry,
  createEntry,
} = require('../controllers/entryController');

const router = Router();

const PART_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

const createValidators = [
  body('pashto').trim().notEmpty().withMessage('pashto is required'),
  body('definitions').isArray({ min: 1 }).withMessage('definitions must be a non-empty array'),
  body('definitions.*.text').trim().notEmpty().withMessage('each definition must have text'),
  body('partOfSpeech').optional().isIn(PART_OF_SPEECH).withMessage(`partOfSpeech must be one of: ${PART_OF_SPEECH.join(', ')}`),
];

// search must come before /:id so Express does not treat "search" as an id param
router.get('/search', searchEntries);
router.get('/', listEntries);
router.get('/:id', getEntry);
router.post('/', verifyToken, createValidators, createEntry);

module.exports = router;
