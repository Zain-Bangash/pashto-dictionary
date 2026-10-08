import FieldDefinition from '../models/FieldDefinition';
import { FieldAppliesTo, FieldType } from '../types/models';

export const APPLIES_TO: FieldAppliesTo[] = ['concept', 'variant'];
export const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'select'];
export const MAX_FIELDS = 20;
export const MAX_OPTIONS = 50;
export const VALUE_MAX: Record<FieldType, number> = { text: 200, textarea: 2000, select: 50 };

type FieldError = { message: string; field: string };
export type ExtraResult = { values: Record<string, string>; error?: undefined } | { error: FieldError };

const fail = (message: string, field: string): ExtraResult => ({ error: { message, field } });

// Textareas keep line breaks; every other control character is dropped
export function clean(raw: string, type: FieldType): string {
  const text = raw.replace(/\r\n?/g, '\n');
  const stripped = type === 'textarea'
    ? text.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    : text.replace(/[\u0000-\u001F\u007F]/g, '');
  return stripped.trim().normalize('NFC');
}

// Returns only the keys whose value changes; '' means clear. `required` is enforced on create only.
export async function validateExtra(
  appliesTo: FieldAppliesTo,
  input: unknown,
  mode: 'create' | 'edit',
  current?: Map<string, string>
): Promise<ExtraResult> {
  if (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input))) {
    return fail('extra must be an object', 'extra');
  }

  const defs = await FieldDefinition.find({ appliesTo }).lean();
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values: Record<string, string> = {};

  for (const [key, raw] of Object.entries((input ?? {}) as Record<string, unknown>)) {
    const field = `extra.${key}`;
    const def = byKey.get(key);
    if (!def) return fail('Unknown field', field);
    if (typeof raw !== 'string') return fail(`${def.label} must be text`, field);

    const value = clean(raw, def.type);
    if (value.length > VALUE_MAX[def.type]) return fail(`${def.label} must be ${VALUE_MAX[def.type]} characters or fewer`, field);

    // An unchanged stored value stays valid even if its field or option was deactivated
    if (value === (current?.get(key) ?? '')) continue;
    if (!def.active) return fail(`${def.label} is no longer in use`, field);
    if (def.type === 'select' && value && !def.options.some((o) => o.active && o.key === value)) {
      return fail(`Invalid option for ${def.label}`, field);
    }
    values[key] = value;
  }

  if (mode === 'create') {
    const missing = defs.find((d) => d.active && d.required && !values[d.key]);
    if (missing) return fail(`${missing.label} is required`, `extra.${missing.key}`);
  }

  return { values };
}

export function initialExtra(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v));
}

// Applies validated values to a document and returns `edited`-style diffs keyed `extra.<key>`
export function applyExtra(doc: { extra?: Map<string, string> }, values: Record<string, string>): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const entries = Object.entries(values);
  if (!entries.length) return changes;
  if (!doc.extra) doc.extra = new Map();
  for (const [key, value] of entries) {
    changes[`extra.${key}`] = { from: doc.extra.get(key) ?? '', to: value };
    if (value) doc.extra.set(key, value);
    else doc.extra.delete(key);
  }
  return changes;
}

export async function generateFieldKey(appliesTo: FieldAppliesTo, label: string): Promise<string> {
  const base = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/^(\d)/, 'f_$1')
    .slice(0, 36)
    .replace(/_+$/, '') || 'field';

  const taken = new Set(
    (await FieldDefinition.find({ appliesTo, key: new RegExp(`^${base}(_\\d+)?$`) }, 'key').lean()).map((d) => d.key)
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}
