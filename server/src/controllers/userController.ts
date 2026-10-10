import { Request, Response } from 'express';
import User from '../models/User';
import ModerationLog from '../models/ModerationLog';

async function getUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  res.status(200).json({ success: true, data, meta: { page, limit, total } });
}

// Admins move users between user and moderator; admin accounts and your own role are changed outside the app
async function changeUserRole(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ success: false, error: { message: 'User not found' } });
    return;
  }

  const role = req.body.role as 'user' | 'moderator';
  const refusal =
    user.cognitoSub === req.user!.id ? "You can't change your own role"
    : user.role === 'admin' ? "An admin's role can't be changed here"
    : user.role === role ? `${user.username} is already a ${role}`
    : null;
  if (refusal) {
    res.status(400).json({ success: false, error: { message: refusal, field: 'role' } });
    return;
  }

  const from = user.role;
  user.role = role;
  await user.save();

  await ModerationLog.create({
    targetModel: 'User',
    targetId: user._id,
    action: 'role_changed',
    performedBy: req.user!.id,
    note: req.body.note || undefined,
    changes: { role: { from, to: role } },
  });

  res.status(200).json({ success: true, data: user.toObject() });
}

export { getUsers, changeUserRole };
