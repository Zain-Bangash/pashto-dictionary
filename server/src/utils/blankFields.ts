import { PipelineStage, Types } from 'mongoose';
import FieldDefinition from '../models/FieldDefinition';
import Variant from '../models/Variant';
import { FORM_KIND_BY_POS, GENDERS, NUMBERS, CASES, VERB_FORMS } from './variantForms';

// The single definition of "blank" for a published variant. `missingFields` are gaps (drive the
// Needs completion count); `fillableFields` add partially filled forms (offered, never counted).

export const SLOT_COUNT: Record<string, number> = {
  noun: GENDERS.length * NUMBERS.length * CASES.length,
  verb: VERB_FORMS.length,
};

export const MISSING_FILTERS = ['any', 'phonetic', 'example', 'forms', 'forms_partial'];
export const MISSING_PATTERN = /^(any|phonetic|example|forms|forms_partial|extra\.[a-z][a-z0-9_]{0,39})$/;

export async function optionalExtraKeys(): Promise<string[]> {
  const defs = await FieldDefinition.find({ appliesTo: 'variant', active: true, required: false }, 'key').lean();
  return defs.map((d) => d.key);
}

const blank = (path: string) => ({ $eq: [{ $ifNull: [path, ''] }, ''] });
const listIf = (cond: unknown, value: string) => ({ $cond: [cond, [value], []] });
const isPublished = { $eq: ['$status', 'published'] };

export function completionStages(extraKeys: string[]): PipelineStage[] {
  const kindBranches = Object.entries(FORM_KIND_BY_POS).map(([pos, kind]) => ({ case: { $eq: ['$concept.partOfSpeech', pos] }, then: kind }));
  const totalBranches = Object.entries(SLOT_COUNT).map(([kind, n]) => ({ case: { $eq: ['$_formKind', kind] }, then: n }));

  return [
    {
      $lookup: {
        from: 'concepts', localField: 'concept', foreignField: '_id', as: 'concept',
        pipeline: [{ $project: { englishGloss: 1, partOfSpeech: 1, status: 1 } }],
      },
    },
    { $unwind: { path: '$concept', preserveNullAndEmptyArrays: true } },
    { $addFields: { _formKind: { $switch: { branches: kindBranches, default: null } } } },
    {
      $addFields: {
        formsFilled: { $size: { $filter: { input: { $ifNull: ['$forms', []] }, cond: { $eq: ['$$this.kind', '$_formKind'] } } } },
        formsTotal: { $switch: { branches: totalBranches, default: 0 } },
      },
    },
    {
      $addFields: {
        missingFields: {
          $cond: [isPublished, {
            $concatArrays: [
              listIf(blank('$phonetic'), 'phonetic'),
              listIf(blank('$example'), 'example'),
              listIf({ $and: [{ $gt: ['$formsTotal', 0] }, { $eq: ['$formsFilled', 0] }] }, 'forms'),
              ...extraKeys.map((key) => listIf(blank(`$extra.${key}`), `extra.${key}`)),
            ],
          }, []],
        },
      },
    },
    {
      $addFields: {
        fillableFields: {
          $concatArrays: ['$missingFields', listIf({
            $and: [isPublished, { $gt: ['$formsFilled', 0] }, { $lt: ['$formsFilled', '$formsTotal'] }],
          }, 'forms')],
        },
      },
    },
    { $project: { _formKind: 0 } },
  ];
}

// `missing` narrows the Needs completion list; 'forms_partial' is the opt-in "Forms: some empty"
export function missingMatch(missing = 'any'): Record<string, unknown> {
  if (missing === 'any') return { missingFields: { $ne: [] } };
  if (missing === 'forms_partial') return { fillableFields: 'forms', formsFilled: { $gt: 0 } };
  return { missingFields: missing };
}

export type Completion = { missingFields: string[]; fillableFields: string[]; formsFilled: number; formsTotal: number };

export async function getCompletion(variantId: Types.ObjectId | string): Promise<Completion | null> {
  const extraKeys = await optionalExtraKeys();
  const [row] = await Variant.aggregate([
    { $match: { _id: new Types.ObjectId(String(variantId)) } },
    ...completionStages(extraKeys),
  ]);
  if (!row) return null;
  const { missingFields, fillableFields, formsFilled, formsTotal } = row as Completion;
  return { missingFields, fillableFields, formsFilled, formsTotal };
}
