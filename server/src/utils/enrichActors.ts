import User from '../models/User';

type Doc = Record<string, unknown>;

/**
 * Batch-resolves cognitoSub UUID strings to User documents.
 * Replaces the named field in each document with the matching User object (or
 * leaves the raw string if no User is found for that sub).
 */
export async function enrichActors(
  docs: Doc[],
  field: string,
  projection = 'username region village cognitoSub'
): Promise<Doc[]> {
  const seen = new Set<string>();
  const subs: string[] = [];
  for (const d of docs) {
    const v = d[field];
    if (typeof v === 'string' && v && !seen.has(v)) {
      subs.push(v);
      seen.add(v);
    }
  }
  if (!subs.length) return docs;

  const users = await User.find({ cognitoSub: { $in: subs } }, projection).lean();
  const byId: Record<string, unknown> = {};
  for (const u of users) {
    const sub = (u as unknown as Doc).cognitoSub as string;
    if (sub) byId[sub] = u;
  }

  return docs.map(d => ({ ...d, [field]: byId[d[field] as string] ?? d[field] }));
}

// Replaces each form's addedBy sub with the contributor's public profile, for "Added by" credits
export async function enrichFormCredits(variants: Doc[]): Promise<Doc[]> {
  const subs = [...new Set(variants.flatMap((v) => ((v.forms as Doc[] | undefined) ?? []).map((f) => f.addedBy).filter((s): s is string => typeof s === 'string')))];
  if (!subs.length) return variants;
  const users = await User.find({ cognitoSub: { $in: subs } }, 'username region village cognitoSub').lean();
  const bySub = new Map(users.map((u) => [u.cognitoSub as string, u]));
  return variants.map((v) => ({
    ...v,
    forms: ((v.forms as Doc[] | undefined) ?? []).map((f) => (typeof f.addedBy === 'string' ? { ...f, addedBy: bySub.get(f.addedBy) ?? f.addedBy } : f)),
  }));
}
