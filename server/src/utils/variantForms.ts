import { body, ValidationChain } from 'express-validator';
import { FormKind, FormGender, FormNumber, FormCase, VerbForm, IVariantForm } from '../types/models';
import { clean } from './extraFields';

export const FORM_KINDS: FormKind[] = ['noun', 'verb'];
export const GENDERS: FormGender[] = ['masculine', 'feminine'];
export const NUMBERS: FormNumber[] = ['singular', 'plural'];
export const CASES: FormCase[] = ['direct', 'oblique'];
export const VERB_FORMS: VerbForm[] = ['infinitive', 'past', 'present', 'imperative'];
export const MAX_FORMS = 16;
export const FORM_MAX = { pashto: 100, phonetic: 100, example: 500 };

// Keyed by the partOfSpeech Lookup key; any other key allows no forms
export const FORM_KIND_BY_POS: Record<string, FormKind> = { noun: 'noun', adjective: 'noun', verb: 'verb' };

const KEYS: Record<FormKind, string[]> = {
  noun: ['kind', 'gender', 'number', 'case', 'pashto', 'phonetic', 'example'],
  verb: ['kind', 'verbForm', 'pashto', 'phonetic', 'example'],
};

type FieldError = { message: string; field: string };
export type FormsResult = { forms?: IVariantForm[]; error?: undefined } | { error: FieldError };

const fail = (message: string, field: string): FormsResult => ({ error: { message, field } });

export const formsValidators: ValidationChain[] = [
  body('forms').optional().isArray({ max: MAX_FORMS }).withMessage(`forms must be a list of at most ${MAX_FORMS} entries`),
  body('forms.*.kind').isIn(FORM_KINDS).withMessage('Invalid form kind'),
  body('forms.*.gender').optional().isIn(GENDERS).withMessage('Invalid gender'),
  body('forms.*.number').optional().isIn(NUMBERS).withMessage('Invalid number'),
  body('forms.*.case').optional().isIn(CASES).withMessage('Invalid case'),
  body('forms.*.verbForm').optional().isIn(VERB_FORMS).withMessage('Invalid verb form'),
  body('forms.*.pashto').isString().withMessage('Form Pashto is required'),
  body('forms.*.phonetic').optional().isString().withMessage('Form phonetic must be text'),
  body('forms.*.example').optional().isString().withMessage('Form example must be text'),
];

export function formSlot(form: Pick<IVariantForm, 'kind' | 'gender' | 'number' | 'case' | 'verbForm'>): string {
  return form.kind === 'noun' ? `${form.gender}.${form.number}.${form.case}` : String(form.verbForm);
}

export const SLOTS_BY_KIND: Record<FormKind, string[]> = {
  noun: GENDERS.flatMap((g) => NUMBERS.flatMap((n) => CASES.map((c) => `${g}.${n}.${c}`))),
  verb: [...VERB_FORMS],
};

const SLOT_ORDER: string[] = [...SLOTS_BY_KIND.noun, ...SLOTS_BY_KIND.verb];

function sameContent(a: IVariantForm, b: IVariantForm): boolean {
  return formSlot(a) === formSlot(b)
    && a.pashto === b.pashto
    && (a.phonetic ?? '') === (b.phonetic ?? '')
    && (a.example ?? '') === (b.example ?? '');
}

function readText(raw: unknown, name: keyof typeof FORM_MAX, field: string): { value?: string; error?: FieldError } {
  if (raw === undefined) return {};
  if (typeof raw !== 'string') return { error: { message: `Form ${name} must be text`, field } };
  const value = clean(raw, 'text');
  if (value.length > FORM_MAX[name]) return { error: { message: `Form ${name} must be ${FORM_MAX[name]} characters or fewer`, field } };
  return { value: value || undefined };
}

function pick<T extends string>(raw: unknown, allowed: T[]): T | undefined {
  return typeof raw === 'string' && (allowed as string[]).includes(raw) ? (raw as T) : undefined;
}

// undefined input means "not sent"; a form identical to a stored one passes even if the part of speech no longer allows it
export function validateForms(input: unknown, partOfSpeech: string | undefined, current: IVariantForm[] = []): FormsResult {
  if (input === undefined) return {};
  if (!Array.isArray(input)) return fail('forms must be a list', 'forms');
  if (input.length > MAX_FORMS) return fail(`forms must be a list of at most ${MAX_FORMS} entries`, 'forms');

  const allowedKind = partOfSpeech ? FORM_KIND_BY_POS[partOfSpeech] : undefined;
  const seen = new Set<string>();
  const forms: IVariantForm[] = [];

  for (const [i, raw] of input.entries()) {
    const at = `forms[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Each form must be an object', at);
    const item = raw as Record<string, unknown>;

    const kind = pick(item.kind, FORM_KINDS);
    if (!kind) return fail('Invalid form kind', `${at}.kind`);
    const unknown = Object.keys(item).find((k) => !KEYS[kind].includes(k));
    if (unknown) return fail('Unknown form property', `${at}.${unknown}`);

    const form: IVariantForm = { kind, pashto: '' };
    if (kind === 'noun') {
      form.gender = pick(item.gender, GENDERS);
      form.number = pick(item.number, NUMBERS);
      form.case = pick(item.case, CASES);
      if (!form.gender) return fail('Noun forms need a gender', `${at}.gender`);
      if (!form.number) return fail('Noun forms need a number', `${at}.number`);
      if (!form.case) return fail('Noun forms need a case', `${at}.case`);
    } else {
      form.verbForm = pick(item.verbForm, VERB_FORMS);
      if (!form.verbForm) return fail('Verb forms need a verb form', `${at}.verbForm`);
    }

    for (const name of ['pashto', 'phonetic', 'example'] as const) {
      const { value, error } = readText(item[name], name, `${at}.${name}`);
      if (error) return { error };
      if (value) form[name] = value;
    }
    if (!form.pashto) return fail('Form Pashto is required', `${at}.pashto`);

    const slot = formSlot(form);
    if (seen.has(slot)) return fail('This form is listed twice', at);
    seen.add(slot);

    if (kind !== allowedKind && !current.some((c) => sameContent(c, form))) {
      return fail(`${kind === 'noun' ? 'Noun' : 'Verb'} forms are not allowed for this part of speech`, `${at}.kind`);
    }
    forms.push(form);
  }

  forms.sort((a, b) => SLOT_ORDER.indexOf(formSlot(a)) - SLOT_ORDER.indexOf(formSlot(b)));
  return { forms };
}

function summary(form: IVariantForm): Record<string, string> {
  return {
    pashto: form.pashto,
    ...(form.phonetic && { phonetic: form.phonetic }),
    ...(form.example && { example: form.example }),
  };
}

// Replaces the stored forms and returns `edited`-style diffs keyed `forms.<slot>`; null means added or removed
export function applyForms(doc: { forms?: IVariantForm[] }, forms: IVariantForm[] | undefined): Record<string, unknown> {
  if (forms === undefined) return {};
  const before = new Map((doc.forms ?? []).map((f) => [formSlot(f), summary(f)]));
  const after = new Map(forms.map((f) => [formSlot(f), summary(f)]));
  doc.forms = forms.length ? forms : undefined;

  const changes: Record<string, unknown> = {};
  for (const slot of SLOT_ORDER) {
    const from = before.get(slot) ?? null;
    const to = after.get(slot) ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[`forms.${slot}`] = { from, to };
  }
  return changes;
}
