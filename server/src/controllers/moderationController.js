const mongoose = require('mongoose');
const Concept = require('../models/Concept');
const Variant = require('../models/Variant');
const ModerationLog = require('../models/ModerationLog');
// Require User so the schema is registered for populate calls
require('../models/User');

async function getConceptQueue(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status) ? req.query.status : 'pending';

  const [data, total, pendingCount, approvedCount] = await Promise.all([
    Concept.find({ status }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('submittedBy', 'username region village').lean(),
    Concept.countDocuments({ status }),
    Concept.countDocuments({ status: 'pending' }),
    isAdmin ? Concept.countDocuments({ status: 'approved' }) : Promise.resolve(0),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

async function getVariantQueue(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status) ? req.query.status : 'pending';

  const [data, total, pendingCount, approvedCount] = await Promise.all([
    Variant.find({ status }).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('submittedBy', 'username region village')
      .populate('concept', 'englishGloss status')
      .lean(),
    Variant.countDocuments({ status }),
    Variant.countDocuments({ status: 'pending' }),
    isAdmin ? Variant.countDocuments({ status: 'approved' }) : Promise.resolve(0),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

async function getStats(req, res) {
  const [
    pendingConcepts,  approvedConcepts,  rejectedConcepts,  publishedConcepts,
    pendingVariants,  approvedVariants,  rejectedVariants,  publishedVariants,
  ] = await Promise.all([
    Concept.countDocuments({ status: 'pending' }),
    Concept.countDocuments({ status: 'approved' }),
    Concept.countDocuments({ status: 'rejected' }),
    Concept.countDocuments({ status: 'published' }),
    Variant.countDocuments({ status: 'pending' }),
    Variant.countDocuments({ status: 'approved' }),
    Variant.countDocuments({ status: 'rejected' }),
    Variant.countDocuments({ status: 'published' }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      pending:   pendingConcepts  + pendingVariants,
      approved:  approvedConcepts + approvedVariants,
      rejected:  rejectedConcepts + rejectedVariants,
      published: publishedConcepts + publishedVariants,
    },
  });
}

async function getLog(req, res) {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip  = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ModerationLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'username')
      .lean(),
    ModerationLog.countDocuments(),
  ]);

  return res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

module.exports = { getConceptQueue, getVariantQueue, getStats, getLog };
