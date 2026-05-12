import mongoose from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import ModerationLog from '../models/ModerationLog';
// Require User so the schema is registered for populate calls
import '../models/User';

async function getConceptQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status as string) ? req.query.status as string : 'pending';

  const [data, total, pendingCount, approvedCount] = await Promise.all([
    Concept.find({ status, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('submittedBy', 'username region village').lean(),
    Concept.countDocuments({ status, isDeleted: { $ne: true } }),
    Concept.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
    isAdmin ? Concept.countDocuments({ status: 'approved', isDeleted: { $ne: true } }) : Promise.resolve(0),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

async function getVariantQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status as string) ? req.query.status as string : 'pending';

  const [data, total, pendingCount, approvedCount] = await Promise.all([
    Variant.find({ status, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('submittedBy', 'username region village')
      .populate('concept', 'englishGloss status')
      .lean(),
    Variant.countDocuments({ status, isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
    isAdmin ? Variant.countDocuments({ status: 'approved', isDeleted: { $ne: true } }) : Promise.resolve(0),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

async function getStats(_req: Request, res: Response): Promise<void> {
  const [
    pendingConcepts,  approvedConcepts,  rejectedConcepts,  publishedConcepts,
    pendingVariants,  approvedVariants,  rejectedVariants,  publishedVariants,
  ] = await Promise.all([
    Concept.countDocuments({ status: 'pending',   isDeleted: { $ne: true } }),
    Concept.countDocuments({ status: 'approved',  isDeleted: { $ne: true } }),
    Concept.countDocuments({ status: 'rejected',  isDeleted: { $ne: true } }),
    Concept.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'pending',   isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'approved',  isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'rejected',  isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      pending:   pendingConcepts  + pendingVariants,
      approved:  approvedConcepts + approvedVariants,
      rejected:  rejectedConcepts + rejectedVariants,
      published: publishedConcepts + publishedVariants,
    },
  });
}

async function getLog(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
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

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

export { getConceptQueue, getVariantQueue, getStats, getLog };
