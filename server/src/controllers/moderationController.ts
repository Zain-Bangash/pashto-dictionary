import mongoose from 'mongoose';
import { Request, Response } from 'express';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import ModerationLog from '../models/ModerationLog';
import { enrichActors } from '../utils/enrichActors';

type Doc = Record<string, unknown>;

async function getConceptQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status as string) ? req.query.status as string : 'pending';

  const [rawData, total, pendingCount, approvedCount] = await Promise.all([
    Concept.find({ status, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Concept.countDocuments({ status, isDeleted: { $ne: true } }),
    Concept.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
    isAdmin ? Concept.countDocuments({ status: 'approved', isDeleted: { $ne: true } }) : Promise.resolve(0),
  ]);
  const data = await enrichActors(rawData as unknown as Doc[], 'submittedBy');

  res.status(200).json({ success: true, data, meta: { page, limit, total, pendingCount, approvedCount } });
}

async function getVariantQueue(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip  = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';
  const allowed = isAdmin ? ['pending', 'approved'] : ['pending'];
  const status  = allowed.includes(req.query.status as string) ? req.query.status as string : 'pending';

  const [rawData, total, pendingCount, approvedCount] = await Promise.all([
    Variant.find({ status, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('concept', 'englishGloss status')
      .lean(),
    Variant.countDocuments({ status, isDeleted: { $ne: true } }),
    Variant.countDocuments({ status: 'pending', isDeleted: { $ne: true } }),
    isAdmin ? Variant.countDocuments({ status: 'approved', isDeleted: { $ne: true } }) : Promise.resolve(0),
  ]);
  const data = await enrichActors(rawData as unknown as Doc[], 'submittedBy');

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

  const VALID_ACTIONS = ['submitted', 'approved', 'rejected', 'published', 'resubmitted', 'profile_updated', 'deleted', 'edited', 'merged'];
  const VALID_MODELS  = ['Concept', 'Variant', 'User'];
  const filter: Record<string, unknown> = {};

  const actionParam = req.query.action as string;
  if (actionParam && VALID_ACTIONS.includes(actionParam)) filter.action = actionParam;

  const modelParam = req.query.targetModel as string;
  if (modelParam && VALID_MODELS.includes(modelParam)) filter.targetModel = modelParam;

  const [rawData, total] = await Promise.all([
    ModerationLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    ModerationLog.countDocuments(filter),
  ]);

  const withPerformers = await enrichActors(rawData as unknown as Doc[], 'performedBy', 'username cognitoSub');

  // Batch-load the concept and variant names for each log entry
  const conceptIds: string[] = [];
  const variantIds: string[] = [];
  for (const log of withPerformers) {
    const id = String(log.targetId ?? '');
    if (!id) continue;
    if (log.targetModel === 'Concept') conceptIds.push(id);
    if (log.targetModel === 'Variant') variantIds.push(id);
  }

  const [concepts, variants] = await Promise.all([
    conceptIds.length ? Concept.find({ _id: { $in: conceptIds } }, 'englishGloss').lean() : Promise.resolve([]),
    variantIds.length ? Variant.find({ _id: { $in: variantIds } }, 'pashto region').lean() : Promise.resolve([]),
  ]);

  const conceptMap: Record<string, unknown> = {};
  for (const c of concepts) conceptMap[String((c as unknown as Doc)._id)] = c;

  const variantMap: Record<string, unknown> = {};
  for (const v of variants) variantMap[String((v as unknown as Doc)._id)] = v;

  const data = withPerformers.map(log => ({
    ...log,
    target: log.targetModel === 'Concept' ? (conceptMap[String(log.targetId)] ?? null)
          : log.targetModel === 'Variant' ? (variantMap[String(log.targetId)] ?? null)
          : null,
  }));

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

export { getConceptQueue, getVariantQueue, getStats, getLog };
