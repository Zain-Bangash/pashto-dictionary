import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import {
  listLookups,
  createLookup,
  updateLookup,
  reorderLookups,
  deactivateLookup,
  reactivateLookup,
} from '../controllers/lookupController';
import { LOOKUP_TYPES, labelChain } from '../utils/lookups';

const router = Router();

const typeMessage = `type must be one of: ${LOOKUP_TYPES.join(', ')}`;

const label = (optional: boolean) => labelChain('label', optional);

const order = body('order').optional().isInt({ min: 0, max: 999 }).withMessage('order must be a whole number from 0 to 999').toInt();
const idParam = param('id').isMongoId().withMessage('Invalid id');

const immutableFields = ['key', 'type', 'isSystem', 'active'].map((f) =>
  body(f).not().exists().withMessage(`${f} cannot be changed`)
);

const listValidators = [query('type').optional().isIn(LOOKUP_TYPES).withMessage(typeMessage)];

const createValidators = [
  body('type').isIn(LOOKUP_TYPES).withMessage(typeMessage),
  label(false),
  order,
];

const updateValidators = [
  idParam,
  ...immutableFields,
  label(true),
  order,
  body().custom((b) => b.label !== undefined || b.order !== undefined).withMessage('Provide label or order'),
];

const reorderValidators = [
  body('type').isIn(LOOKUP_TYPES).withMessage(typeMessage),
  body('ids').isArray({ min: 1, max: 100 }).withMessage('ids must be a non-empty array'),
  body('ids.*').isMongoId().withMessage('ids must be valid ids'),
];

router.get('/', listValidators, listLookups);
router.post('/', verifyToken, requireRole('admin'), createValidators, createLookup);
router.put('/order', verifyToken, requireRole('admin'), reorderValidators, reorderLookups);
router.patch('/:id', verifyToken, requireRole('admin'), updateValidators, updateLookup);
router.patch('/:id/deactivate', verifyToken, requireRole('admin'), idParam, deactivateLookup);
router.patch('/:id/reactivate', verifyToken, requireRole('admin'), idParam, reactivateLookup);

export = router;
