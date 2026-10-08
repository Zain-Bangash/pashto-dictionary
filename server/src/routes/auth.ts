import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, updateProfile } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { activeLookup, lookupFormat } from '../utils/lookups';

const router = Router();

const registerValidators = [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('password must contain at least one special character'),
  activeLookup('region', 'region', 'falsy'),
  body('village').optional().isString().trim().isLength({ max: 100 }).withMessage('Village name too long'),
];

const loginValidators = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

const profileValidators = [
  body('region').optional().isString().trim().isLength({ max: 50 }).withMessage('Invalid region'),
  body('village').optional().isString().trim().isLength({ max: 100 }).withMessage('Village name too long'),
];

router.post('/register', authLimiter, registerValidators, register);
router.post('/login', authLimiter, loginValidators, login);
router.get('/me', verifyToken, me);
router.patch('/profile', verifyToken, profileValidators, updateProfile);

export = router;
