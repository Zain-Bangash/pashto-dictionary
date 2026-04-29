const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const ModerationLog = require('../models/ModerationLog');

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
    region: user.region,
    village: user.village,
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

  const { username, email, password, region, village } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    return res.status(409).json({
      success: false,
      error: { message: `${field} already in use`, field },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await new User({ username, email, passwordHash, region, village }).save();
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

async function me(req, res) {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
  return res.status(200).json({ success: true, data: { user: safeUser(user) } });
}

async function updateProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ success: false, error: { message: first.msg, field: first.path } });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

  const { region, village } = req.body;
  if (region !== undefined) user.region = region || undefined;
  if (village !== undefined) user.village = village?.trim() || undefined;
  await user.save();

  await new ModerationLog({
    targetModel: 'User',
    targetId: user._id,
    action: 'profile_updated',
    performedBy: req.user.id,
  }).save();

  return res.status(200).json({ success: true, data: { user: safeUser(user) } });
}

module.exports = { register, login, me, updateProfile };
