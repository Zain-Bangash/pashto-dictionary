import { Request } from 'express';
import { query, ValidationChain } from 'express-validator';
import { Types } from 'mongoose';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import User from '../models/User';
import { escapeRegex, searchRegex } from './mySubmissions';
import { normalizePashto } from './normalize';

// q matches the English gloss, the Pashto word or the phonetic; region is the word's region; user is the submitter's username
export interface QueueFilters {
  q?: string;
  region?: string;
  submitter?: string;
}

const NO_ONE = '\u0000';

export function queueFilterValidators(): ValidationChain[] {
  return [
    query('q').optional().isString().trim().isLength({ max: 100 }).withMessage('Search must be 100 characters or fewer'),
    query('region').optional().isString().trim().isLength({ max: 50 }).withMessage('Invalid region'),
    query('user').optional().isString().trim().isLength({ max: 50 }).withMessage('Invalid username'),
  ];
}

export async function readQueueFilters(req: Request): Promise<QueueFilters> {
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined;
  const region = typeof req.query.region === 'string' && req.query.region ? req.query.region : undefined;
  const username = typeof req.query.user === 'string' && req.query.user.trim() ? req.query.user.trim() : undefined;
  let submitter: string | undefined;
  if (username) {
    const user = await User.findOne({ username }, 'cognitoSub').collation({ locale: 'en', strength: 2 }).lean();
    submitter = user?.cognitoSub ?? NO_ONE;
  }
  return { q, region, submitter };
}

// Conditions on Variant for q and region; undefined when neither is set
export async function variantMatch(filters: QueueFilters): Promise<Record<string, unknown> | undefined> {
  if (!filters.q && !filters.region) return undefined;
  const match: Record<string, unknown> = {};
  if (filters.region) match.region = filters.region;
  if (filters.q) {
    const glossIds = await Concept.distinct('_id', { englishGloss: searchRegex(filters.q) });
    const pashto = normalizePashto(filters.q);
    match.$or = [
      { concept: { $in: glossIds } },
      { phonetic: searchRegex(filters.q) },
      ...(pashto ? [{ normalizedPashto: new RegExp(escapeRegex(pashto)) }] : []),
    ];
  }
  return match;
}

// For queues of things attached to a variant (suggestions, recordings)
export async function variantIdsMatching(filters: QueueFilters): Promise<Types.ObjectId[] | undefined> {
  const match = await variantMatch(filters);
  return match ? Variant.distinct('_id', match) : undefined;
}
