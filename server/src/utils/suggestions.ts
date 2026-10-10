import { Types } from 'mongoose';
import VariantSuggestion from '../models/VariantSuggestion';
import ModerationLog from '../models/ModerationLog';
import { IVariantForm, IVariantSuggestion, OPEN_SUGGESTION_STATUSES } from '../types/models';
import { clean, validateExtra } from './extraFields';
import { validateForms, applyForms, formSlot, FORM_MAX } from './variantForms';
import { optionalExtraKeys } from './blankFields';

type FieldError = { message: string; field: string };
export type PlainProposal = { phonetic?: string; example?: string; forms?: IVariantForm[]; extra?: Record<string, string> };
export type ProposalResult = { proposed: PlainProposal; error?: undefined } | { error: FieldError };

// The parts of a variant a proposal is checked against
export type VariantFields = { phonetic?: string; example?: string; forms?: IVariantForm[]; extra?: Map<string, string> | Record<string, string> };

export const PROPOSAL_KEYS = ['phonetic', 'example', 'forms', 'extra'];
export const PROPOSAL_MAX = { phonetic: FORM_MAX.phonetic, example: FORM_MAX.example };
const TEXT_LABELS = { phonetic: 'Phonetic', example: 'Example' } as const;

const fail = (message: string, field: string): ProposalResult => ({ error: { message, field } });

export function plainExtra(extra?: Map<string, string> | Record<string, string>): Record<string, string> {
  if (!extra) return {};
  return extra instanceof Map ? Object.fromEntries(extra) : { ...extra };
}

export function slotName(slot: string): string {
  const [gender, number, grammaticalCase] = slot.split('.');
  return number ? `${gender} ${number}, ${grammaticalCase}` : gender;
}

function plainForm(form: IVariantForm): IVariantForm {
  const { kind, gender, number, case: c, verbForm, pashto, phonetic, example } = form;
  return Object.fromEntries(
    Object.entries({ kind, gender, number, case: c, verbForm, pashto, phonetic, example }).filter(([, v]) => v !== undefined && v !== null)
  ) as unknown as IVariantForm;
}

export function proposalToPlain(proposed: IVariantSuggestion['proposed']): PlainProposal {
  const out: PlainProposal = {};
  if (proposed.phonetic) out.phonetic = proposed.phonetic;
  if (proposed.example) out.example = proposed.example;
  if (proposed.forms?.length) out.forms = proposed.forms.map((f) => plainForm(f));
  const extra = plainExtra(proposed.extra);
  if (Object.keys(extra).length) out.extra = extra;
  return out;
}

// Fill-only: every proposed value must go into a field that is blank on the live variant.
// Used at submit, resubmit, staff edit and again at publish.
export async function validateProposal(
  input: Record<string, unknown>,
  variant: VariantFields,
  partOfSpeech: string | undefined
): Promise<ProposalResult> {
  const proposed: PlainProposal = {};

  for (const name of ['phonetic', 'example'] as const) {
    const raw = input[name];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') return fail(`${TEXT_LABELS[name]} must be text`, name);
    const value = clean(raw, 'text');
    if (value.length > PROPOSAL_MAX[name]) return fail(`${TEXT_LABELS[name]} must be ${PROPOSAL_MAX[name]} characters or fewer`, name);
    if (!value) continue;
    if (variant[name]) return fail(`${TEXT_LABELS[name]} is already filled and cannot be changed`, name);
    proposed[name] = value;
  }

  if (input.forms !== undefined) {
    const result = validateForms(input.forms, partOfSpeech);
    if (result.error) return { error: result.error };
    const filled = new Set((variant.forms ?? []).map(formSlot));
    const clash = (result.forms ?? []).find((f) => filled.has(formSlot(f)));
    if (clash) return fail(`Form (${slotName(formSlot(clash))}) is already filled and cannot be changed`, `forms.${formSlot(clash)}`);
    if (result.forms?.length) proposed.forms = result.forms;
  }

  if (input.extra !== undefined) {
    const result = await validateExtra('variant', input.extra, 'edit');
    if (result.error) return { error: result.error };
    const allowed = await optionalExtraKeys();
    const current = plainExtra(variant.extra);
    for (const [key, value] of Object.entries(result.values)) {
      if (!value) continue;
      if (!allowed.includes(key)) return fail('This field cannot be suggested', `extra.${key}`);
      if (current[key]) return fail('This field is already filled and cannot be changed', `extra.${key}`);
      (proposed.extra ??= {})[key] = value;
    }
  }

  if (!Object.keys(proposed).length) return fail('Suggest at least one missing detail', 'proposed');
  return { proposed };
}

// Each person may have one open suggestion per word
export async function findOpenSuggestion(variantId: Types.ObjectId | string, submittedBy: string) {
  return VariantSuggestion.findOne({ variant: variantId, submittedBy, status: { $in: OPEN_SUGGESTION_STATUSES } });
}

// Only the word's submitter may fill phonetic, example and extra fields; anyone else may only propose forms
export function formsOnlyError(input: Record<string, unknown>, submittedBy: string, wordOwner?: string): FieldError | undefined {
  if (submittedBy === wordOwner) return undefined;
  const filled = (v: unknown) => v !== undefined && v !== null && v !== '';
  const field = (['phonetic', 'example'] as const).find((k) => filled(input[k]))
    ?? (input.extra && typeof input.extra === 'object' && Object.values(input.extra).some(filled) ? 'extra' : undefined);
  if (!field) return undefined;
  return { message: "Only the word's submitter can suggest this detail. You can suggest grammatical forms.", field };
}

// Fields any open suggestion proposes; staff edits outside the suggestion review cannot touch them
export async function lockedFields(variantId: Types.ObjectId | string): Promise<Set<string>> {
  const open = await VariantSuggestion.find({ variant: variantId, status: { $in: OPEN_SUGGESTION_STATUSES } });
  const locked = new Set<string>();
  for (const s of open) {
    const plain = proposalToPlain(s.proposed);
    (['phonetic', 'example'] as const).filter((k) => plain[k]).forEach((k) => locked.add(k));
    (plain.forms ?? []).forEach((f) => locked.add(`forms.${formSlot(f)}`));
    Object.keys(plain.extra ?? {}).forEach((k) => locked.add(`extra.${k}`));
  }
  return locked;
}

export async function logSuggestion(id: Types.ObjectId, action: string, performedBy: string, note?: string, changes?: Record<string, unknown>) {
  await new ModerationLog({ targetModel: 'VariantSuggestion', targetId: id, action, performedBy, note, changes }).save();
}

// Cascade: when a variant leaves the published state, its open suggestions are rejected with a note
export async function rejectOpenSuggestions(variantIds: (Types.ObjectId | string)[], performedBy: string, note: string): Promise<void> {
  if (!variantIds.length) return;
  const open = await VariantSuggestion.find({ variant: { $in: variantIds }, status: { $in: OPEN_SUGGESTION_STATUSES } });
  await Promise.all(open.map(async (s) => {
    s.status = 'rejected';
    s.reviewedBy = performedBy;
    s.moderatorNote = note;
    await s.save();
    await logSuggestion(s._id as Types.ObjectId, 'rejected', performedBy, 'Cascaded from word rejection or removal');
  }));
}

const LOCK_LABELS: Record<string, string> = { phonetic: 'Phonetic', example: 'Example' };

// Returns an error when a staff edit would change a field that an open suggestion proposes
export function lockClash(
  locked: Set<string>,
  body: Record<string, unknown>,
  variant: VariantFields,
  extraValues: Record<string, string>,
  forms: IVariantForm[] | undefined
): FieldError | undefined {
  if (!locked.size) return undefined;
  const changed = [
    ...(['phonetic', 'example'] as const).filter((k) => body[k] !== undefined && String(body[k] ?? '') !== (variant[k] ?? '')),
    ...Object.keys(extraValues).map((k) => `extra.${k}`),
    ...Object.keys(applyForms({ forms: variant.forms }, forms)),
  ];
  const field = changed.find((f) => locked.has(f));
  if (!field) return undefined;
  const label = LOCK_LABELS[field] ?? (field.startsWith('forms.') ? `Form (${slotName(field.slice(6))})` : 'This field');
  return { message: `${label} has an open suggestion. Review it in Suggestions first.`, field };
}
