import { Types } from 'mongoose';
import Variant from '../models/Variant';
import Concept from '../models/Concept';
import VariantSuggestion from '../models/VariantSuggestion';
import ModerationLog from '../models/ModerationLog';
import { IVariant, IVariantSuggestion } from '../types/models';
import { validateForms, applyForms, formSlot } from './variantForms';
import { normalizePashto, normalizePhonetic } from './normalize';
import { validateProposal, proposalToPlain, logSuggestion, PlainProposal } from './suggestions';

type FieldError = { message: string; field?: string };
export type ApplyResult =
  | { suggestion: IVariantSuggestion; variant: IVariant; error?: undefined }
  | { error: FieldError; status: number };

type LeanVariant = Pick<IVariant, 'phonetic' | 'example' | 'forms' | 'extra' | 'concept' | 'updatedAt' | 'status' | 'isDeleted' | 'submittedBy'> & { _id: Types.ObjectId; extra?: Record<string, string> };

function buildUpdate(variant: LeanVariant, proposed: PlainProposal, contributor: string, partOfSpeech?: string) {
  const set: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  if (proposed.phonetic) {
    set.phonetic = proposed.phonetic;
    set.normalizedPhonetic = normalizePhonetic(proposed.phonetic);
    changes.phonetic = { from: '', to: proposed.phonetic };
  }
  if (proposed.example) {
    set.example = proposed.example;
    changes.example = { from: '', to: proposed.example };
  }
  for (const [key, value] of Object.entries(proposed.extra ?? {})) {
    set[`extra.${key}`] = value;
    changes[`extra.${key}`] = { from: '', to: value };
  }
  if (proposed.forms?.length) {
    const current = (variant.forms ?? []).map(({ normalizedPashto: _n, addedBy: _a, ...f }) => f);
    const merged = validateForms([...current, ...proposed.forms], partOfSpeech, current);
    if (merged.error) return { error: merged.error };
    // Credit the contributor on each new form; forms with no addedBy belong to the word's submitter
    const credit = new Map((variant.forms ?? []).filter((f) => f.addedBy).map((f) => [formSlot(f), f.addedBy as string]));
    if (contributor !== variant.submittedBy) proposed.forms.forEach((f) => credit.set(formSlot(f), contributor));
    const forms = (merged.forms ?? []).map((f) => {
      const addedBy = credit.get(formSlot(f));
      return { ...f, ...(addedBy && { addedBy }), normalizedPashto: normalizePashto(f.pashto) };
    });
    Object.assign(changes, applyForms({ forms: variant.forms }, forms));
    set.forms = forms;
  }
  return { set, changes };
}

async function revert(id: Types.ObjectId): Promise<void> {
  await VariantSuggestion.updateOne({ _id: id, status: 'published' }, { $set: { status: 'approved' } });
}

// Claims the suggestion, re-checks fill-only against the current word, then writes only if the
// word has not changed since it was read. No transaction: a failure puts the suggestion back to approved.
export async function applySuggestion(id: string, adminId: string): Promise<ApplyResult> {
  const claimed = await VariantSuggestion.findOneAndUpdate(
    { _id: id, status: 'approved' },
    { $set: { status: 'published', reviewedBy: adminId } },
    { returnDocument: 'after' }
  );
  if (!claimed) return { status: 400, error: { message: 'Only approved suggestions can be published' } };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const variant = await Variant.findById(claimed.variant).lean() as unknown as LeanVariant | null;
    if (!variant || variant.isDeleted || variant.status !== 'published') {
      await revert(claimed._id as Types.ObjectId);
      return { status: 400, error: { message: 'The word is no longer published' } };
    }

    const concept = await Concept.findById(variant.concept, 'partOfSpeech').lean();
    const proposal = proposalToPlain(claimed.proposed);
    const check = await validateProposal(proposal as Record<string, unknown>, variant, concept?.partOfSpeech);
    if (check.error) {
      await revert(claimed._id as Types.ObjectId);
      return { status: 400, error: { ...check.error, message: `Cannot publish: ${check.error.message}. Edit or reject the suggestion.` } };
    }

    const update = buildUpdate(variant, check.proposed, claimed.submittedBy, concept?.partOfSpeech);
    if ('error' in update && update.error) {
      await revert(claimed._id as Types.ObjectId);
      return { status: 400, error: update.error };
    }
    const { set, changes } = update as { set: Record<string, unknown>; changes: Record<string, unknown> };

    const written = await Variant.updateOne({ _id: variant._id, updatedAt: variant.updatedAt }, { $set: set });
    if (written.matchedCount === 0) continue;

    await logSuggestion(claimed._id as Types.ObjectId, 'published', adminId);
    await new ModerationLog({
      targetModel: 'Variant',
      targetId: variant._id,
      action: 'suggestion_applied',
      performedBy: adminId,
      changes: { ...changes, suggestionId: claimed._id },
    }).save();

    const updated = await Variant.findById(variant._id);
    return { suggestion: claimed, variant: updated! };
  }

  await revert(claimed._id as Types.ObjectId);
  return { status: 409, error: { message: 'The word changed while publishing. Please try again.' } };
}
