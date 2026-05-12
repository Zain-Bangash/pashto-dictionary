import { Request, Response } from 'express';
import User from '../models/User';

async function getUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    User.find({}, '-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

export { getUsers };
