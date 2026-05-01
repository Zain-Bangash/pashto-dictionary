const Variant = require('../models/Variant');
const User    = require('../models/User');

async function getStats(req, res) {
  const now          = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [publishedVariants, registeredUsers, variantsThisMonth] = await Promise.all([
    Variant.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
    User.countDocuments({}),
    Variant.countDocuments({ status: 'published', isDeleted: { $ne: true }, createdAt: { $gte: firstOfMonth } }),
  ]);

  return res.status(200).json({
    success: true,
    data: { publishedVariants, registeredUsers, variantsThisMonth },
  });
}

module.exports = { getStats };
