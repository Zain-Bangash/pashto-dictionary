import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Variant from '../models/Variant';
import VariantSuggestion from '../models/VariantSuggestion';

type Loader = (id: string) => Promise<{ submittedBy?: string } | null>;

// Loads the document named by :id into res.locals[key]; 404 if missing, 403 unless the caller submitted it
function loadOwned(key: string, label: string, load: Loader) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: { message: `Invalid ${label} id` } });
      return;
    }
    const doc = await load(id);
    if (!doc) {
      res.status(404).json({ success: false, error: { message: `${label.charAt(0).toUpperCase()}${label.slice(1)} not found` } });
      return;
    }
    if (doc.submittedBy !== req.user!.id) {
      res.status(403).json({ success: false, error: { message: 'Forbidden' } });
      return;
    }
    res.locals[key] = doc;
    next();
  };
}

export const loadOwnedVariant = loadOwned('variant', 'variant', (id) => Variant.findById(id));
export const loadOwnedSuggestion = loadOwned('suggestion', 'suggestion', (id) => VariantSuggestion.findById(id));
