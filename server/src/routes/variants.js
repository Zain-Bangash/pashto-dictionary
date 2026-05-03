const { Router } = require('express');
const { body } = require('express-validator');
const { verifyToken, optionalVerifyToken } = require('../middleware/auth');
const { requireModeratorOrAdmin, requireRole } = require('../middleware/requireRole');
const {
  createVariant,
  listVariants,
  getVariant,
  updateVariant,
  transitionVariantStatus,
  searchVariants,
  getMyVariantSubmissions,
  deleteVariant,
  editVariant,
} = require('../controllers/variantController');

const router = Router();

const REGIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];

const createValidators = [
  body('conceptId').trim().notEmpty().withMessage('conceptId is required'),
  body('pashto').trim().notEmpty().withMessage('pashto is required'),
  body('region').isIn(REGIONS).withMessage(`region must be one of: ${REGIONS.join(', ')}`),
  body('definition').trim().notEmpty().withMessage('definition is required'),
  body('submissionNote').optional().isString().trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
];

const updateValidators = [
  body('region').optional().isIn(REGIONS).withMessage(`region must be one of: ${REGIONS.join(', ')}`),
  body('submissionNote').optional().isString().trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
];

const statusValidators = [
  body('status')
    .isIn(['approved', 'rejected', 'published'])
    .withMessage('status must be approved, rejected, or published'),
];

// static paths must come before /:id
router.get('/search', searchVariants);
router.get('/my-submissions', verifyToken, getMyVariantSubmissions);
router.get('/', verifyToken, requireModeratorOrAdmin, listVariants);
router.get('/:id', optionalVerifyToken, getVariant);
router.post('/', verifyToken, createValidators, createVariant);
router.patch('/:id/edit', verifyToken, requireModeratorOrAdmin, editVariant);
router.patch('/:id/status', verifyToken, requireModeratorOrAdmin, statusValidators, transitionVariantStatus);
router.patch('/:id', verifyToken, updateValidators, updateVariant);
router.delete('/:id', verifyToken, requireRole('admin'), deleteVariant);

module.exports = router;
