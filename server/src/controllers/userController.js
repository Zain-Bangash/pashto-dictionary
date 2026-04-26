const User = require('../models/User');

async function getUsers(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    User.find({}, '-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

module.exports = { getUsers };
