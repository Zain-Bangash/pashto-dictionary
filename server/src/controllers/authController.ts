import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import User from '../models/User';
import { IUser } from '../types/models';
import ModerationLog from '../models/ModerationLog';

function signToken(user: IUser): string {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );
}

function safeUser(user: IUser | (Omit<IUser, keyof Document> & { _id: unknown; username: string; email: string; role: string; region?: string; village?: string; createdAt: Date })) {
  return {
    id: (user as IUser)._id,
    username: user.username,
    email: user.email,
    role: user.role,
    region: user.region,
    village: user.village,
    createdAt: user.createdAt,
  };
}

async function register(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({
      success: false,
      error: { message: first.msg, field: (first as { path?: string }).path },
    });
    return;
  }

  const { username, email, password, region, village } = req.body as {
    username: string;
    email: string;
    password: string;
    region?: string;
    village?: string;
  };

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    const field = existing.email === email.toLowerCase() ? 'email' : 'username';
    res.status(409).json({
      success: false,
      error: { message: `${field} already in use`, field },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await new User({ username, email, passwordHash, region, village }).save();
  const token = signToken(user);

  res.status(201).json({
    success: true,
    data: { token, user: safeUser(user) },
  });
}

async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({
      success: false,
      error: { message: first.msg, field: (first as { path?: string }).path },
    });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid credentials' },
    });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid credentials' },
    });
    return;
  }

  const token = signToken(user);

  res.status(200).json({
    success: true,
    data: { token, user: safeUser(user) },
  });
}

async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id).lean() as IUser | null;
  if (!user) {
    res.status(404).json({ success: false, error: { message: 'User not found' } });
    return;
  }
  res.status(200).json({ success: true, data: { user: safeUser(user) } });
}

async function updateProfile(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    res.status(400).json({ success: false, error: { message: first.msg, field: (first as { path?: string }).path } });
    return;
  }

  const user = await User.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ success: false, error: { message: 'User not found' } });
    return;
  }

  const { region, village } = req.body as { region?: string; village?: string };
  if (region !== undefined) user.region = (region || undefined) as IUser['region'];
  if (village !== undefined) user.village = village?.trim() || undefined;
  await user.save();

  await new ModerationLog({
    targetModel: 'User',
    targetId: user._id,
    action: 'profile_updated',
    performedBy: req.user!.id,
  }).save();

  res.status(200).json({ success: true, data: { user: safeUser(user) } });
}

export { register, login, me, updateProfile };
