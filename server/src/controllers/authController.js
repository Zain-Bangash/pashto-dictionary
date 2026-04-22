const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: { message: first.msg, field: first.path },
    });
  }

  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    return res.status(409).json({
      success: false,
      error: { message: `${field} already in use`, field },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await new User({ username, email, passwordHash }).save();
  const token = signToken(user);

  return res.status(201).json({
    success: true,
    data: { token, user: safeUser(user) },
  });
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: { message: first.msg, field: first.path },
    });
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid credentials' },
    });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid credentials' },
    });
  }

  const token = signToken(user);

  return res.status(200).json({
    success: true,
    data: { token, user: safeUser(user) },
  });
}

function me(req, res) {
  return res.status(200).json({
    success: true,
    data: { user: req.user },
  });
}

module.exports = { register, login, me };
