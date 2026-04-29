const { Router } = require('express');
const { body } = require('express-validator');
const { register, login, me, updateProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

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

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.get('/me', verifyToken, me);
router.patch('/profile', verifyToken, profileValidators, updateProfile);

module.exports = router;
