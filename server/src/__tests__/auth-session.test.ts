// Persistent sessions — refresh cookie set on login/register, POST /refresh and POST /logout.
// All Cognito SDK calls are mocked.
process.env.SKIP_RATE_LIMIT = 'true';
process.env.COGNITO_USER_POOL_ID = 'ap-southeast-1_testpool';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.COGNITO_CLIENT_SECRET = 'test-client-secret';
process.env.AWS_REGION = 'ap-southeast-1';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const mockCognitoSend = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: { create: jest.fn(() => ({ verify: jest.fn() })) },
}));

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const command = (type: string) => jest.fn().mockImplementation((input) => ({ _type: type, input }));
  return {
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: mockCognitoSend })),
    SignUpCommand: command('SignUpCommand'),
    AdminConfirmSignUpCommand: command('AdminConfirmSignUpCommand'),
    AdminDeleteUserCommand: command('AdminDeleteUserCommand'),
    InitiateAuthCommand: command('InitiateAuthCommand'),
    RevokeTokenCommand: command('RevokeTokenCommand'),
  };
});

import 'express-async-errors';
import express from 'express';
import supertest from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRouter from '../routes/auth';
import User from '../models/User';
import logger from '../utils/logger';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ success: false, error: { message: err.message } });
});
const request = supertest(app);

const SUB = 'cognito-sub-abc';
const REFRESH_TOKEN = 'refresh-token-value';
const accessTokenFor = (sub: string) => jwt.sign({ sub, username: sub }, 'irrelevant');

function cognitoError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

function cookieHeader(res: supertest.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

function sessionPost(path: string, cookies = `pd_rt=${REFRESH_TOKEN}; pd_ru=${SUB}`) {
  return request.post(path)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', cookies);
}

async function seedUser(sub = SUB) {
  return new User({ username: 'sessionuser', email: 'session@example.com', cognitoSub: sub, role: 'user' }).save();
}

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  process.env.NODE_ENV = 'test';
  delete process.env.COOKIE_SAMESITE;
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

describe('login and register set the session cookies', () => {
  beforeEach(() => {
    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') return Promise.resolve({ UserSub: SUB });
      if (cmd._type === 'InitiateAuthCommand') {
        return Promise.resolve({ AuthenticationResult: { AccessToken: accessTokenFor(SUB), RefreshToken: REFRESH_TOKEN } });
      }
      return Promise.resolve({});
    });
  });

  it('login sets an httpOnly refresh cookie scoped to /api/auth for 30 days', async () => {
    await seedUser();
    const res = await request.post('/api/auth/login').send({ email: 'session@example.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    const rt = cookieHeader(res, 'pd_rt')!;
    expect(rt).toContain(`pd_rt=${REFRESH_TOKEN}`);
    expect(rt).toContain('HttpOnly');
    expect(rt).toContain('Path=/api/auth');
    expect(rt).toContain('Max-Age=2592000');
    expect(rt).toContain('SameSite=Lax');
    expect(rt).not.toContain('Secure');
    expect(cookieHeader(res, 'pd_ru')).toContain(`pd_ru=${SUB}`);
  });

  it('login does not return the refresh token in the body', async () => {
    await seedUser();
    const res = await request.post('/api/auth/login').send({ email: 'session@example.com', password: 'Password1!' });
    expect(JSON.stringify(res.body)).not.toContain(REFRESH_TOKEN);
  });

  it('register sets the refresh cookie', async () => {
    const res = await request.post('/api/auth/register')
      .send({ username: 'newuser', email: 'new@example.com', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(cookieHeader(res, 'pd_rt')).toContain('HttpOnly');
  });

  it('in production with SameSite=None the cookie is Secure and Partitioned', async () => {
    process.env.NODE_ENV = 'production';
    process.env.COOKIE_SAMESITE = 'none';
    await seedUser();
    const res = await request.post('/api/auth/login').send({ email: 'session@example.com', password: 'Password1!' });
    const rt = cookieHeader(res, 'pd_rt')!;
    expect(rt).toContain('Secure');
    expect(rt).toContain('SameSite=None');
    expect(rt).toContain('Partitioned');
  });

  it('in production without COOKIE_SAMESITE the cookie defaults to Secure and Strict', async () => {
    process.env.NODE_ENV = 'production';
    await seedUser();
    const res = await request.post('/api/auth/login').send({ email: 'session@example.com', password: 'Password1!' });
    const rt = cookieHeader(res, 'pd_rt')!;
    expect(rt).toContain('Secure');
    expect(rt).toContain('SameSite=Strict');
    expect(rt).not.toContain('Partitioned');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new access token and the user', async () => {
    await seedUser();
    const accessToken = accessTokenFor(SUB);
    mockCognitoSend.mockResolvedValue({ AuthenticationResult: { AccessToken: accessToken } });

    const res = await sessionPost('/api/auth/refresh');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe(accessToken);
    expect(res.body.data.user.username).toBe('sessionuser');
    expect(res.body.data.user.cognitoSub).toBeUndefined();
  });

  it('calls REFRESH_TOKEN_AUTH with a SECRET_HASH computed from the username cookie', async () => {
    await seedUser();
    mockCognitoSend.mockResolvedValue({ AuthenticationResult: { AccessToken: accessTokenFor(SUB) } });

    await sessionPost('/api/auth/refresh');

    const { input } = mockCognitoSend.mock.calls[0][0];
    const expectedHash = createHmac('sha256', 'test-client-secret').update(SUB + 'test-client-id').digest('base64');
    expect(input.AuthFlow).toBe('REFRESH_TOKEN_AUTH');
    expect(input.AuthParameters).toEqual({ REFRESH_TOKEN: REFRESH_TOKEN, SECRET_HASH: expectedHash });
  });

  it('does not set cookies when Cognito does not rotate the refresh token', async () => {
    await seedUser();
    mockCognitoSend.mockResolvedValue({ AuthenticationResult: { AccessToken: accessTokenFor(SUB) } });
    const res = await sessionPost('/api/auth/refresh');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('re-sets the cookie when Cognito returns a rotated refresh token', async () => {
    await seedUser();
    mockCognitoSend.mockResolvedValue({ AuthenticationResult: { AccessToken: accessTokenFor(SUB), RefreshToken: 'rotated' } });
    const res = await sessionPost('/api/auth/refresh');
    expect(cookieHeader(res, 'pd_rt')).toContain('pd_rt=rotated');
  });

  it('returns 401 and does not call Cognito when the cookie is missing', async () => {
    const res = await sessionPost('/api/auth/refresh', '');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });

  it('returns 401 when the username cookie is missing', async () => {
    const res = await sessionPost('/api/auth/refresh', `pd_rt=${REFRESH_TOKEN}`);
    expect(res.status).toBe(401);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });

  it.each(['NotAuthorizedException', 'UserNotFoundException'])(
    'returns 401 and clears both cookies when Cognito throws %s (invalid, expired or revoked)',
    async (name) => {
      mockCognitoSend.mockRejectedValue(cognitoError(name));
      const res = await sessionPost('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Session expired');
      expect(cookieHeader(res, 'pd_rt')).toMatch(/pd_rt=;.*Expires=Thu, 01 Jan 1970/);
      expect(cookieHeader(res, 'pd_ru')).toMatch(/pd_ru=;/);
    },
  );

  it('returns 401 when the Cognito user has no MongoDB profile', async () => {
    mockCognitoSend.mockResolvedValue({ AuthenticationResult: { AccessToken: accessTokenFor('orphan-sub') } });
    const res = await sessionPost('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 500 on an unexpected Cognito failure', async () => {
    mockCognitoSend.mockRejectedValue(cognitoError('InternalErrorException'));
    const res = await sessionPost('/api/auth/refresh');
    expect(res.status).toBe(500);
  });

  it('returns 403 without the X-Requested-With header', async () => {
    const res = await request.post('/api/auth/refresh').set('Cookie', `pd_rt=${REFRESH_TOKEN}; pd_ru=${SUB}`);
    expect(res.status).toBe(403);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });

  it('returns 403 from a foreign Origin', async () => {
    const res = await sessionPost('/api/auth/refresh').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token with the client secret and clears both cookies', async () => {
    mockCognitoSend.mockResolvedValue({});
    const res = await sessionPost('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: {} });
    const { _type, input } = mockCognitoSend.mock.calls[0][0];
    expect(_type).toBe('RevokeTokenCommand');
    expect(input).toEqual({ Token: REFRESH_TOKEN, ClientId: 'test-client-id', ClientSecret: 'test-client-secret' });
    expect(cookieHeader(res, 'pd_rt')).toMatch(/pd_rt=;.*Path=\/api\/auth/);
    expect(cookieHeader(res, 'pd_ru')).toMatch(/pd_ru=;/);
  });

  it('returns 200 without calling Cognito when there is no cookie', async () => {
    const res = await sessionPost('/api/auth/logout', '');
    expect(res.status).toBe(200);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });

  it('still clears the cookies and returns 200 when revocation fails, without logging the token', async () => {
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {});
    mockCognitoSend.mockRejectedValue(cognitoError('UnsupportedTokenTypeException'));

    const res = await sessionPost('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(cookieHeader(res, 'pd_rt')).toMatch(/pd_rt=;/);
    expect(logged).toHaveBeenCalled();
    expect(logged.mock.calls.flat().join(' ')).not.toContain(REFRESH_TOKEN);
  });

  it('returns 403 without the X-Requested-With header', async () => {
    const res = await request.post('/api/auth/logout').set('Cookie', `pd_rt=${REFRESH_TOKEN}`);
    expect(res.status).toBe(403);
    expect(mockCognitoSend).not.toHaveBeenCalled();
  });
});
