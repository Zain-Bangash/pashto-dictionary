import { Request, Response } from 'express';
import Variant from '../models/Variant';
import User from '../models/User';

async function getStats(_req: Request, res: Response): Promise<void> {
  const now          = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [publishedVariants, registeredUsers, variantsThisMonth] = await Promise.all([
    Variant.countDocuments({ status: 'published', isDeleted: { $ne: true } }),
    User.countDocuments({}),
    Variant.countDocuments({ status: 'published', isDeleted: { $ne: true }, createdAt: { $gte: firstOfMonth } }),
  ]);

  res.status(200).json({
    success: true,
    data: { publishedVariants, registeredUsers, variantsThisMonth },
  });
}

export { getStats };
