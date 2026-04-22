const { Router } = require('express');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
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

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.get('/me', verifyToken, me);

module.exports = router;
