import { InitiateAuthCommand, RevokeTokenCommand } from '@aws-sdk/client-cognito-identity-provider';
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import User from '../models/User';
import { IUser } from '../types/models';
import logger from '../utils/logger';
import { safeUser } from '../utils/safeUser';
import { cognitoClient, CLIENT_ID, CLIENT_SECRET, secretHash, decodeAccessTokenClaims } from '../utils/cognito';
import { setSessionCookies, clearSessionCookies, readSessionCookies } from '../utils/sessionCookies';

const SESSION_ENDED_ERRORS = ['NotAuthorizedException', 'UserNotFoundException'];

function endSession(res: Response): void {
  clearSessionCookies(res);
  res.status(401).json({ success: false, error: { message: 'Session expired' } });
}

async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken, username } = readSessionCookies(req);
  if (!validationResult(req).isEmpty() || !refreshToken || !username) {
    endSession(res);
    return;
  }

  let accessToken: string | undefined;
  let rotatedRefreshToken: string | undefined;
  try {
    const hash = secretHash(username);
    const result = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken, ...(hash && { SECRET_HASH: hash }) },
    }));
    accessToken = result.AuthenticationResult?.AccessToken;
    rotatedRefreshToken = result.AuthenticationResult?.RefreshToken;
  } catch (err) {
    if (SESSION_ENDED_ERRORS.includes((err as { name?: string }).name ?? '')) {
      endSession(res);
      return;
    }
    throw err;
  }

  const claims = accessToken ? decodeAccessTokenClaims(accessToken) : null;
  const user = claims?.sub
    ? await User.findOne({ cognitoSub: claims.sub }).lean() as IUser | null
    : null;
  if (!accessToken || !user) {
    endSession(res);
    return;
  }

  if (rotatedRefreshToken) setSessionCookies(res, rotatedRefreshToken, claims?.username ?? username);
  res.status(200).json({ success: true, data: { token: accessToken, user: safeUser(user) } });
}

async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = readSessionCookies(req);
  if (refreshToken) {
    await cognitoClient.send(new RevokeTokenCommand({
      Token: refreshToken,
      ClientId: CLIENT_ID,
      ...(CLIENT_SECRET && { ClientSecret: CLIENT_SECRET }),
    })).catch((err: { name?: string }) => logger.error(`RevokeToken failed: ${err.name ?? 'unknown error'}`));
  }
  clearSessionCookies(res);
  res.status(200).json({ success: true, data: {} });
}

export { refresh, logout };
