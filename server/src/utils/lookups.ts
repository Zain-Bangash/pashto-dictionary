import { body, ValidationChain } from 'express-validator';
import Lookup from '../models/Lookup';
import { LookupType } from '../types/models';

export const LOOKUP_TYPES: LookupType[] = ['region', 'partOfSpeech', 'semanticDomain'];
export const LABEL_MAX = 50;
export const MAX_PER_TYPE = 100;

export const SYSTEM_LOOKUPS: Record<LookupType, string[]> = {
  region: ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'],
  partOfSpeech: ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'],
  semanticDomain: [],
};

const FIELD_NAMES: Record<LookupType, string> = { region: 'region', partOfSpeech: 'part of speech', semanticDomain: 'domain' };

// Control characters and angle brackets are never valid in a label
export const SAFE_LABEL = /^[^\u0000-\u001F\u007F<>]+$/;

export async function getActiveKeys(type: LookupType): Promise<string[]> {
  const rows = await Lookup.find({ type, active: true }, 'key').lean();
  return rows.map((r) => r.key);
}

// An unchanged stored value stays valid even after it is deactivated; a newly chosen one must be active
export function isUnchanged(value: string, currentValue?: string): boolean {
  return currentValue !== undefined && value === currentValue;
}

export async function isAllowedLookup(type: LookupType, value: string, currentValue?: string): Promise<boolean> {
  if (isUnchanged(value, currentValue)) return true;
  return (await Lookup.exists({ type, key: value, active: true })) !== null;
}

export function labelChain(field = 'label', optional = false): ValidationChain {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .isString().withMessage(`${field} must be a string`)
    .trim()
    .notEmpty().withMessage(`${field} is required`)
    .isLength({ max: LABEL_MAX }).withMessage(`${field} must be ${LABEL_MAX} characters or fewer`)
    .matches(SAFE_LABEL).withMessage(`${field} contains invalid characters`);
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

export const MAX_DOMAINS = 10;

export function domainsFormat(field = 'semanticDomains'): ValidationChain[] {
  return [
    body(field).optional().isArray({ max: MAX_DOMAINS }).withMessage(`${field} must be a list of at most ${MAX_DOMAINS} domains`),
    body(`${field}.*`)
      .isString().withMessage('Each domain must be a string')
      .trim()
      .notEmpty().withMessage('A domain cannot be empty')
      .isLength({ max: LABEL_MAX }).withMessage('Invalid domain'),
  ];
}

// Domains already on the concept stay valid after deactivation; newly added ones must be active
export async function checkDomains(values: string[], current: string[] = []): Promise<{ values: string[] } | { error: { message: string; field: string } }> {
  const unique = [...new Set(values)];
  const added = unique.filter((v) => !current.includes(v));
  const allowed = added.length ? await getActiveKeys('semanticDomain') : [];
  if (added.some((v) => !allowed.includes(v))) {
    return { error: { message: invalidLookupMessage('semanticDomain'), field: 'semanticDomains' } };
  }
  return { values: unique };
}
