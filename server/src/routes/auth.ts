import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, updateProfile } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

const registerValidators = [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters'),
];

const loginValidators = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

const profileValidators = [
  body('region').optional().isIn(['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar']).withMessage('Invalid region'),
  body('village').optional().isString().trim().isLength({ max: 100 }).withMessage('Village name too long'),
];

router.post('/register', authLimiter, registerValidators, register);
router.post('/login', authLimiter, loginValidators, login);
router.get('/me', verifyToken, me);
router.patch('/profile', verifyToken, profileValidators, updateProfile);

export = router;
