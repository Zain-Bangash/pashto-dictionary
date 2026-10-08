import { body, ValidationChain } from 'express-validator';
import Lookup from '../models/Lookup';
import { LookupType } from '../types/models';

export const LOOKUP_TYPES: LookupType[] = ['region', 'partOfSpeech'];
export const LABEL_MAX = 50;
export const MAX_PER_TYPE = 100;

export const SYSTEM_LOOKUPS: Record<LookupType, string[]> = {
  region: ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'],
  partOfSpeech: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
};

const FIELD_NAMES: Record<LookupType, string> = { region: 'region', partOfSpeech: 'part of speech' };

// Control characters and angle brackets are never valid in a label
export const SAFE_LABEL = /^[^\u0000-\u001F\u007F<>]+$/;

export async function getActiveKeys(type: LookupType): Promise<string[]> {
  const rows = await Lookup.find({ type, active: true }, 'key').lean();
  return rows.map((r) => r.key);
}

// An unchanged stored value stays valid even after it is deactivated; a newly chosen one must be active
export async function isAllowedLookup(type: LookupType, value: string, currentValue?: string): Promise<boolean> {
  if (currentValue !== undefined && value === currentValue) return true;
  return (await Lookup.exists({ type, key: value, active: true })) !== null;
}

export function invalidLookupMessage(type: LookupType): string {
  return `Invalid ${FIELD_NAMES[type]}`;
}

type Optional = boolean | 'falsy';

export function lookupFormat(field: string, optional: Optional = false): ValidationChain {
  const chain = body(field);
  return (optional ? chain.optional(optional === 'falsy' ? { values: 'falsy' } : undefined) : chain)
    .isString().withMessage(`${field} must be a string`)
    .trim()
    .notEmpty().withMessage(`${field} is required`)
    .isLength({ max: LABEL_MAX }).withMessage(`${field} must be ${LABEL_MAX} characters or fewer`);
}

export function activeLookup(type: LookupType, field: string, optional: Optional = false): ValidationChain {
  return lookupFormat(field, optional).custom(async (value: string) => {
    if (!(await isAllowedLookup(type, value))) throw new Error(invalidLookupMessage(type));
    return true;
  });
}

export async function ensureSystemLookups({ dryRun = false } = {}): Promise<string[]> {
  const ops = LOOKUP_TYPES.flatMap((type) =>
    SYSTEM_LOOKUPS[type].map((key, i) => ({ type, key, order: i }))
  );

  const existing = await Lookup.find({ $or: ops.map(({ type, key }) => ({ type, key })) }, 'type key').lean();
  const have = new Set(existing.map((r) => `${r.type}:${r.key}`));
  const missing = ops.filter((o) => !have.has(`${o.type}:${o.key}`));

  if (!dryRun && missing.length) {
    await Lookup.bulkWrite(
      missing.map(({ type, key, order }) => ({
        updateOne: {
          filter: { type, key },
          update: { $setOnInsert: { type, key, label: key, order, active: true, isSystem: true } },
          upsert: true,
        },
      }))
    );
  }

  return missing.map((o) => `${o.type}:${o.key}`);
}
