import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

async function resolveRole(sub: string): Promise<'user' | 'moderator' | 'admin'> {
  const user = await User.findOne({ cognitoSub: sub }, 'role').lean();
  return (user?.role as 'user' | 'moderator' | 'admin') ?? 'user';
}

async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { message: 'No token provided' } });
    return;
  }
  const token = authHeader.slice(7);
  if (!token) {
    res.status(401).json({ success: false, error: { message: 'No token provided' } });
    return;
  }
  try {
    const payload = await verifier.verify(token);
    const role = await resolveRole(payload.sub);
    req.user = { id: payload.sub, role };
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid or expired token' } });
  }
}

async function optionalVerifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifier.verify(token);
    const role = await resolveRole(payload.sub);
    req.user = { id: payload.sub, role };
  } catch {
    // invalid token on public route — treat as unauthenticated
  }
  next();
}

export { verifyToken, optionalVerifyToken };
