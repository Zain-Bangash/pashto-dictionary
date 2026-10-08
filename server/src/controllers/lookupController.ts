import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Lookup from '../models/Lookup';
import ModerationLog from '../models/ModerationLog';
import { ILookup, LookupType } from '../types/models';
import { MAX_PER_TYPE } from '../utils/lookups';
import { sendValidationError } from '../utils/sendValidationError';

function notFound(res: Response) {
  return res.status(404).json({ success: false, error: { message: 'List value not found' } });
}

function labelTaken(type: LookupType, label: string, excludeId?: Types.ObjectId) {
  return Lookup.findOne({
    type,
    $or: [{ key: label }, { label }],
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).collation({ locale: 'en', strength: 2 });
}

function logLookup(req: Request, row: ILookup | null, changes: Record<string, unknown>) {
  return new ModerationLog({
    targetModel: 'Lookup',
    targetId: row?._id,
    action: 'lookup_changed',
    performedBy: req.user!.id,
    changes,
  }).save();
}

async function listLookups(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const page  = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 200));
  const filter = req.query.type ? { type: req.query.type as string } : {};

  const [data, total] = await Promise.all([
    Lookup.find(filter, 'type key label order active isSystem')
      .sort({ type: 1, order: 1, key: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lookup.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

async function createLookup(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const type = req.body.type as LookupType;
  const label = (req.body.label as string).normalize('NFC');

  if ((await Lookup.countDocuments({ type })) >= MAX_PER_TYPE) {
    res.status(400).json({ success: false, error: { message: `A list can hold at most ${MAX_PER_TYPE} values` } });
    return;
  }
  if (await labelTaken(type, label)) {
    res.status(409).json({ success: false, error: { message: 'That value already exists in this list', field: 'label' } });
    return;
  }

  const last = await Lookup.findOne({ type }).sort({ order: -1 }).lean();
  const order = req.body.order ?? (last ? last.order + 1 : 0);
  const row = await new Lookup({ type, key: label, label, order }).save();

  await logLookup(req, row, { op: 'created', type, key: row.key, label: row.label });
  res.status(201).json({ success: true, data: row });
}

async function updateLookup(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const row = await Lookup.findById(req.params.id);
  if (!row) {
    notFound(res);
    return;
  }

  const changes: Record<string, unknown> = { op: 'updated', type: row.type, key: row.key };
  if (req.body.label !== undefined) {
    const label = (req.body.label as string).normalize('NFC');
    if (label !== row.label && (await labelTaken(row.type, label, row._id as Types.ObjectId))) {
      res.status(409).json({ success: false, error: { message: 'That value already exists in this list', field: 'label' } });
      return;
    }
    if (label !== row.label) changes.label = { from: row.label, to: label };
    row.label = label;
  }
  if (req.body.order !== undefined && req.body.order !== row.order) {
    changes.order = { from: row.order, to: req.body.order };
    row.order = req.body.order as number;
  }

  await row.save();
  if (changes.label || changes.order) await logLookup(req, row, changes);
  res.status(200).json({ success: true, data: row });
}

async function reorderLookups(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const type = req.body.type as LookupType;
  const ids = req.body.ids as string[];
  const rows = await Lookup.find({ type }).sort({ order: 1, key: 1 });

  const known = new Set(rows.map((r) => String(r._id)));
  if (ids.length !== rows.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    res.status(400).json({ success: false, error: { message: 'ids must list every value of this type exactly once', field: 'ids' } });
    return;
  }

  const byId = new Map(rows.map((r) => [String(r._id), r]));
  await Lookup.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  await logLookup(req, null, {
    op: 'reordered',
    type,
    from: rows.map((r) => r.key),
    to: ids.map((id) => byId.get(id)!.key),
  });

  const data = await Lookup.find({ type }).sort({ order: 1, key: 1 }).lean();
  res.status(200).json({ success: true, data, meta: { page: 1, limit: data.length, total: data.length } });
}

function setActive(active: boolean) {
  return async function (req: Request, res: Response): Promise<void> {
    if (sendValidationError(req, res)) return;

    const row = await Lookup.findById(req.params.id);
    if (!row) {
      notFound(res);
      return;
    }
    if (!active && row.isSystem) {
      res.status(400).json({ success: false, error: { message: 'Built-in values cannot be deactivated' } });
      return;
    }
    if (row.active === active) {
      res.status(400).json({ success: false, error: { message: `Value is already ${active ? 'active' : 'inactive'}` } });
      return;
    }

    row.active = active;
    await row.save();
    await logLookup(req, row, { op: active ? 'reactivated' : 'deactivated', type: row.type, key: row.key, label: row.label });
    res.status(200).json({ success: true, data: row });
  };
}

const deactivateLookup = setActive(false);
const reactivateLookup = setActive(true);

export { listLookups, createLookup, updateLookup, reorderLookups, deactivateLookup, reactivateLookup };
