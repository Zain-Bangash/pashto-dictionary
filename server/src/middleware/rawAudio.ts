import express, { Request, Response, NextFunction } from 'express';
import { MAX_AUDIO_BYTES } from '../utils/audioClips';

const parse = express.raw({ type: () => true, limit: MAX_AUDIO_BYTES });

// Reads the request body as bytes; runs after auth so unauthenticated uploads are never buffered
export function rawAudio(req: Request, res: Response, next: NextFunction): void {
  parse(req, res, (err?: { type?: string }) => {
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ success: false, error: { message: 'The recording must be 1 MB or smaller', field: 'audio' } });
      return;
    }
    next(err);
  });
}
