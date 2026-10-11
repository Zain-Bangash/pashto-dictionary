import { Request, Response } from 'express';
import Concept from '../models/Concept';
import Variant from '../models/Variant';
import AudioClip from '../models/AudioClip';
import VariantSuggestion from '../models/VariantSuggestion';
import { AUDIO_STATUSES } from '../types/models';
import { REVIEW_STATUSES } from '../utils/mySubmissions';

type Row = { _id: string; n: number };
type Tally = Record<string, number>;

function tally(rows: Row[], statuses: string[]): Tally {
  const out: Tally = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const { _id, n } of rows) if (_id in out) out[_id] = n;
  out.total = Object.values(out).reduce((a, b) => a + b, 0);
  return out;
}

const byStatus = [{ $group: { _id: '$status', n: { $sum: 1 } } }];

// Counts behind the My Submissions headers and summary strip; the filters match what each list shows
async function getSubmissionSummary(req: Request, res: Response): Promise<void> {
  const me = req.user!.id;

  const [concepts, variants, audio, suggestions] = await Promise.all([
    Concept.aggregate<Row>([{ $match: { submittedBy: me, isDeleted: { $ne: true } } }, ...byStatus]),
    // Rejected variants are soft-deleted but still listed so the submitter can read the note
    Variant.aggregate<Row>([{ $match: { submittedBy: me, $or: [{ isDeleted: { $ne: true } }, { status: 'rejected' }] } }, ...byStatus]),
    AudioClip.aggregate<Row>([{ $match: { submittedBy: me } }, ...byStatus]),
    // Suggestions on other people's words; those on my own words show on the word's row
    VariantSuggestion.aggregate<Row>([
      { $match: { submittedBy: me } },
      { $lookup: { from: 'variants', localField: 'variant', foreignField: '_id', as: 'variant', pipeline: [{ $project: { submittedBy: 1 } }] } },
      { $unwind: '$variant' },
      { $match: { 'variant.submittedBy': { $ne: me } } },
      ...byStatus,
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      concepts: tally(concepts, REVIEW_STATUSES),
      variants: tally(variants, REVIEW_STATUSES),
      audio: tally(audio, AUDIO_STATUSES),
      suggestions: tally(suggestions, REVIEW_STATUSES),
    },
  });
}

export { getSubmissionSummary };
