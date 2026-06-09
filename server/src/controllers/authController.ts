import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  AdminDeleteUserCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import User from '../models/User';
import { IUser } from '../types/models';
import ModerationLog from '../models/ModerationLog';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

function secretHash(username: string): string | undefined {
  if (!CLIENT_SECRET) return undefined;
  return createHmac('sha256', CLIENT_SECRET).update(username + CLIENT_ID).digest('base64');
}

type SafeUserInput = IUser | (Omit<IUser, keyof Document> & {
  _id: unknown;
  username: string;
  email: string;
  role: string;
  region?: string;
  village?: string;
  createdAt: Date;
});

function safeUser(user: SafeUserInput) {
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

function decodeAccessTokenSub(accessToken: string): string | null {
  const parts = accessToken.split('.');
  if (parts.length < 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
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

  const normalizedEmail = email.toLowerCase();

  // Check for duplicate username in MongoDB before calling Cognito
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    res.status(409).json({
      success: false,
      error: { message: 'username already in use', field: 'username' },
    });
    return;
  }

  // Sign up in Cognito — UserSub is the stable identifier
  let cognitoSub: string;
  try {
    const signUpResult = await cognitoClient.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash(normalizedEmail),
      Username: normalizedEmail,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: normalizedEmail },
        { Name: 'preferred_username', Value: username },
      ],
    }));
    cognitoSub = signUpResult.UserSub!;
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'UsernameExistsException') {
      res.status(409).json({
        success: false,
        error: { message: 'email already in use', field: 'email' },
      });
      return;
    }
    if (errName === 'InvalidPasswordException') {
      res.status(400).json({
        success: false,
        error: { message: 'Password does not meet requirements. Use at least 8 characters with an uppercase letter, a number, and a special character.', field: 'password' },
      });
      return;
    }
    throw err;
  }

  // Everything after SignUp must be atomic — if it fails, remove the Cognito user
  // so the email is not permanently locked and the user can retry.
  let accessToken: string;
  let user: IUser;
  try {
    await cognitoClient.send(new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: normalizedEmail,
    }));

    const authResult = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: normalizedEmail,
        PASSWORD: password,
        ...(secretHash(normalizedEmail) && { SECRET_HASH: secretHash(normalizedEmail) }),
      },
    }));

    accessToken = authResult.AuthenticationResult!.AccessToken!;

    user = await new User({
      username,
      email: normalizedEmail,
      cognitoSub,
      role: 'user',
      region,
      village,
    }).save();
  } catch (err) {
    await cognitoClient.send(new AdminDeleteUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: normalizedEmail,
    })).catch(() => {});
    throw err;
  }

  res.status(201).json({
    success: true,
    data: { token: accessToken, user: safeUser(user) },
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
  const normalizedEmail = email.toLowerCase();

  let accessToken: string;
  let cognitoSub: string;
  try {
    const authResult = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: normalizedEmail,
        PASSWORD: password,
        ...(secretHash(normalizedEmail) && { SECRET_HASH: secretHash(normalizedEmail) }),
      },
    }));
    const ar = authResult.AuthenticationResult!;
    accessToken = ar.AccessToken!;
    // Prefer sub from JWT payload; fall back to sub field on AuthenticationResult (test mocks)
    cognitoSub = decodeAccessTokenSub(accessToken) ?? (ar as Record<string, unknown>)['sub'] as string;
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'NotAuthorizedException' || errName === 'UserNotFoundException') {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials' },
      });
      return;
    }
    throw err;
  }

  const user = await User.findOne({ cognitoSub }).lean() as IUser | null;
  if (!user) {
    res.status(401).json({ success: false, error: { message: 'User not found' } });
    return;
  }

  res.status(200).json({
    success: true,
    data: { token: accessToken, user: safeUser(user) },
  });
}

async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findOne({ cognitoSub: req.user!.id }).lean() as IUser | null;
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
    res.status(400).json({
      success: false,
      error: { message: first.msg, field: (first as { path?: string }).path },
    });
    return;
  }

  const user = await User.findOne({ cognitoSub: req.user!.id });
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
