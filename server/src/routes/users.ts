import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { rejectInvalid } from '../utils/sendValidationError';
import { getUsers, changeUserRole } from '../controllers/userController';

const router = Router();

const listValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

const roleValidators = [
  param('id').isMongoId().withMessage('Invalid user id'),
  body('role').isIn(['user', 'moderator']).withMessage('role must be user or moderator'),
  body('note').optional().isString().trim().isLength({ max: 500 }).withMessage('Note must be 500 characters or fewer'),
];

router.use(verifyToken);

router.get('/', requireRole('admin'), listValidators, rejectInvalid, getUsers);
router.patch('/:id/role', requireRole('admin'), roleValidators, rejectInvalid, changeUserRole);

export = router;
