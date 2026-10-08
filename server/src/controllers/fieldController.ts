import { Request, Response } from 'express';
import { Types } from 'mongoose';
import FieldDefinition from '../models/FieldDefinition';
import ModerationLog from '../models/ModerationLog';
import { FieldAppliesTo, FieldType, IFieldDefinition } from '../types/models';
import { MAX_FIELDS, MAX_OPTIONS, generateFieldKey } from '../utils/extraFields';
import { sendValidationError } from '../utils/sendValidationError';

type Changes = Record<string, unknown>;

function notFound(res: Response, what = 'Field') {
  return res.status(404).json({ success: false, error: { message: `${what} not found` } });
}

function badRequest(res: Response, message: string, field?: string) {
  return res.status(400).json({ success: false, error: { message, ...(field && { field }) } });
}

function conflict(res: Response, field: string) {
  return res.status(409).json({ success: false, error: { message: 'That label is already in use', field } });
}

const sameText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

function labelTaken(appliesTo: FieldAppliesTo, label: string, excludeId?: Types.ObjectId) {
  return FieldDefinition.findOne({ appliesTo, label, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .collation({ locale: 'en', strength: 2 });
}

function logField(req: Request, def: IFieldDefinition | null, changes: Changes) {
  return new ModerationLog({
    targetModel: 'FieldDefinition',
    targetId: def?._id,
    action: 'field_changed',
    performedBy: req.user!.id,
    changes,
  }).save();
}

async function loadField(req: Request, res: Response): Promise<IFieldDefinition | null> {
  if (sendValidationError(req, res)) return null;
  const def = await FieldDefinition.findById(req.params.id);
  if (!def) notFound(res);
  return def;
}

function listFields(activeOnly: boolean) {
  return async function (req: Request, res: Response): Promise<void> {
    if (sendValidationError(req, res)) return;
    const filter: Record<string, unknown> = {};
    if (req.query.appliesTo) filter.appliesTo = req.query.appliesTo;
    if (activeOnly) filter.active = true;
    const data = await FieldDefinition.find(filter).sort({ appliesTo: 1, order: 1, key: 1 }).lean();
    res.status(200).json({ success: true, data, meta: { page: 1, limit: MAX_FIELDS * 2, total: data.length } });
  };
}

async function createField(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const appliesTo = req.body.appliesTo as FieldAppliesTo;
  const type = req.body.type as FieldType;
  const label = (req.body.label as string).normalize('NFC');
  const optionLabels = ((req.body.options ?? []) as { label: string }[]).map((o) => o.label.normalize('NFC'));

  if (type === 'select' && optionLabels.length === 0) return void badRequest(res, 'A dropdown needs at least one option', 'options');
  if (type !== 'select' && optionLabels.length > 0) return void badRequest(res, 'Only dropdown fields have options', 'options');
  if (optionLabels.some((l, i) => optionLabels.findIndex((o) => sameText(o, l)) !== i)) {
    return void badRequest(res, 'Option labels must be unique', 'options');
  }
  if ((await FieldDefinition.countDocuments({ appliesTo })) >= MAX_FIELDS) {
    return void badRequest(res, `At most ${MAX_FIELDS} fields can be defined for each entry type`);
  }
  if (await labelTaken(appliesTo, label)) return void conflict(res, 'label');

  const last = await FieldDefinition.findOne({ appliesTo }).sort({ order: -1 }).lean();
  const def = await new FieldDefinition({
    appliesTo,
    key: await generateFieldKey(appliesTo, label),
    label,
    type,
    required: req.body.required ?? false,
    order: last ? last.order + 1 : 0,
    options: optionLabels.map((l) => ({ key: l, label: l })),
  }).save();

  await logField(req, def, { op: 'created', appliesTo, key: def.key, label, type, required: def.required });
  res.status(201).json({ success: true, data: def });
}

async function updateField(req: Request, res: Response): Promise<void> {
  const def = await loadField(req, res);
  if (!def) return;

  const changes: Changes = { op: 'updated', appliesTo: def.appliesTo, key: def.key };
  if (req.body.label !== undefined) {
    const label = (req.body.label as string).normalize('NFC');
    if (label !== def.label) {
      if (await labelTaken(def.appliesTo, label, def._id as Types.ObjectId)) return void conflict(res, 'label');
      changes.label = { from: def.label, to: label };
      def.label = label;
    }
  }
  for (const prop of ['required', 'order'] as const) {
    if (req.body[prop] !== undefined && req.body[prop] !== def[prop]) {
      changes[prop] = { from: def[prop], to: req.body[prop] };
      (def[prop] as unknown) = req.body[prop];
    }
  }

  await def.save();
  if (changes.label || changes.required || changes.order) await logField(req, def, changes);
  res.status(200).json({ success: true, data: def });
}

async function reorderFields(req: Request, res: Response): Promise<void> {
  if (sendValidationError(req, res)) return;

  const appliesTo = req.body.appliesTo as FieldAppliesTo;
  const ids = req.body.ids as string[];
  const defs = await FieldDefinition.find({ appliesTo }).sort({ order: 1, key: 1 });
  const known = new Set(defs.map((d) => String(d._id)));
  if (ids.length !== defs.length || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
    return void badRequest(res, 'ids must list every field of this entry type exactly once', 'ids');
  }

  const byId = new Map(defs.map((d) => [String(d._id), d]));
  await FieldDefinition.bulkWrite(ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
  await logField(req, null, { op: 'reordered', appliesTo, from: defs.map((d) => d.key), to: ids.map((id) => byId.get(id)!.key) });

  const data = await FieldDefinition.find({ appliesTo }).sort({ order: 1, key: 1 }).lean();
  res.status(200).json({ success: true, data, meta: { page: 1, limit: data.length, total: data.length } });
}

function setFieldActive(active: boolean) {
  return async function (req: Request, res: Response): Promise<void> {
    const def = await loadField(req, res);
    if (!def) return;
    if (def.active === active) return void badRequest(res, `Field is already ${active ? 'active' : 'inactive'}`);

    def.active = active;
    await def.save();
    await logField(req, def, { op: active ? 'reactivated' : 'deactivated', appliesTo: def.appliesTo, key: def.key, label: def.label });
    res.status(200).json({ success: true, data: def });
  };
}

async function addOption(req: Request, res: Response): Promise<void> {
  const def = await loadField(req, res);
  if (!def) return;
  if (def.type !== 'select') return void badRequest(res, 'Only dropdown fields have options');
  if (def.options.length >= MAX_OPTIONS) return void badRequest(res, `A dropdown can have at most ${MAX_OPTIONS} options`);

  const label = (req.body.label as string).normalize('NFC');
  if (def.options.some((o) => sameText(o.key, label) || sameText(o.label, label))) return void conflict(res, 'label');

  def.options.push({ key: label, label, active: true });
  await def.save();
  await logField(req, def, { op: 'option_added', appliesTo: def.appliesTo, key: def.key, option: { key: label, label } });
  res.status(201).json({ success: true, data: def });
}

async function renameOption(req: Request, res: Response): Promise<void> {
  const def = await loadField(req, res);
  if (!def) return;
  const option = def.options.id(req.params.optionId as string);
  if (!option) return void notFound(res, 'Option');

  const label = (req.body.label as string).normalize('NFC');
  if (label !== option.label) {
    const others = def.options.filter((o) => String(o._id) !== String(option._id));
    if (others.some((o) => sameText(o.key, label) || sameText(o.label, label))) return void conflict(res, 'label');
    const from = option.label;
    option.label = label;
    await def.save();
    await logField(req, def, { op: 'option_renamed', appliesTo: def.appliesTo, key: def.key, option: { key: option.key, label: { from, to: label } } });
  }
  res.status(200).json({ success: true, data: def });
}

function setOptionActive(active: boolean) {
  return async function (req: Request, res: Response): Promise<void> {
    const def = await loadField(req, res);
    if (!def) return;
    const option = def.options.id(req.params.optionId as string);
    if (!option) return void notFound(res, 'Option');
    if (option.active === active) return void badRequest(res, `Option is already ${active ? 'active' : 'inactive'}`);
    if (!active && def.options.filter((o) => o.active).length === 1) {
      return void badRequest(res, 'A dropdown must keep at least one active option');
    }

    option.active = active;
    await def.save();
    await logField(req, def, {
      op: active ? 'option_reactivated' : 'option_deactivated',
      appliesTo: def.appliesTo,
      key: def.key,
      option: { key: option.key, label: option.label },
    });
    res.status(200).json({ success: true, data: def });
  };
}

const listActiveFields = listFields(true);
const listAllFields = listFields(false);

export {
  listActiveFields,
  listAllFields,
  createField,
  updateField,
  reorderFields,
  setFieldActive,
  addOption,
  renameOption,
  setOptionActive,
};
