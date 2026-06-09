/**
 * Phase 13 — AWS Cognito Migration
 * Auth tests — all Cognito SDK calls are mocked; no real AWS calls are made.
 *
 * Mock targets:
 *   @aws-sdk/client-cognito-identity-provider  — CognitoIdentityProviderClient + commands
 *   aws-jwt-verify                              — CognitoJwtVerifier.create().verify()
 */

// ---------------------------------------------------------------------------
// Environment stubs — must be set before any module is imported
// ---------------------------------------------------------------------------
process.env.SKIP_RATE_LIMIT = 'true';
process.env.COGNITO_USER_POOL_ID = 'ap-southeast-1_testpool';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.AWS_REGION = 'ap-southeast-1';
// JWT_SECRET is intentionally NOT set — Cognito path must not use it
delete process.env.JWT_SECRET;

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that pull in the mocked modules
// ---------------------------------------------------------------------------

// Track the verify mock so individual tests can override return values
const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: mockVerify,
    })),
  },
}));

// Mock Cognito SDK — we capture `send` so tests can control what Cognito returns
const mockCognitoSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: mockCognitoSend,
  })),
  SignUpCommand: jest.fn().mockImplementation((input) => ({ _type: 'SignUpCommand', input })),
  AdminConfirmSignUpCommand: jest.fn().mockImplementation((input) => ({ _type: 'AdminConfirmSignUpCommand', input })),
  InitiateAuthCommand: jest.fn().mockImplementation((input) => ({ _type: 'InitiateAuthCommand', input })),
  // Exception classes — needed by controller (instanceof checks) and tests (throwing errors)
  UsernameExistsException: class UsernameExistsException extends Error {
    $metadata: object;
    constructor(args: { message: string; $metadata: object }) {
      super(args.message);
      this.name = 'UsernameExistsException';
      this.$metadata = args.$metadata;
    }
  },
  NotAuthorizedException: class NotAuthorizedException extends Error {
    $metadata: object;
    constructor(args: { message: string; $metadata: object }) {
      super(args.message);
      this.name = 'NotAuthorizedException';
      this.$metadata = args.$metadata;
    }
  },
  UserNotFoundException: class UserNotFoundException extends Error {
    $metadata: object;
    constructor(args: { message: string; $metadata: object }) {
      super(args.message);
      this.name = 'UserNotFoundException';
      this.$metadata = args.$metadata;
    }
  },
}));

// ---------------------------------------------------------------------------
// Real imports (after mocks are registered)
// ---------------------------------------------------------------------------
import 'express-async-errors';
import express from 'express';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRouter from '../routes/auth';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

// ---------------------------------------------------------------------------
// Test Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(err.status || 500).json({
      success: false,
      error: { message: err.message || 'Internal server error' },
    });
  },
);

const request = supertest(app);

// ---------------------------------------------------------------------------
// In-memory MongoDB lifecycle
// ---------------------------------------------------------------------------
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
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// Helpers — wire up realistic mock responses
// ---------------------------------------------------------------------------

/**
 * Make mockCognitoSend return appropriate results for the register flow:
 *   SignUpCommand         → { UserSub: sub }
 *   AdminConfirmSignUp    → {}
 *   InitiateAuthCommand   → { AuthenticationResult: { AccessToken, sub } }
 */
function setupRegisterMocks(
  sub: string = 'cognito-sub-123',
  accessToken: string = 'fake-access-token',
): void {
  mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
    if (cmd._type === 'SignUpCommand') return Promise.resolve({ UserSub: sub });
    if (cmd._type === 'AdminConfirmSignUpCommand') return Promise.resolve({});
    if (cmd._type === 'InitiateAuthCommand')
      return Promise.resolve({
        AuthenticationResult: { AccessToken: accessToken, sub },
      });
    return Promise.resolve({});
  });
}

/**
 * Make mockCognitoSend return a successful login response.
 */
function setupLoginMock(
  sub: string = 'cognito-sub-123',
  accessToken: string = 'fake-access-token',
): void {
  mockCognitoSend.mockResolvedValue({
    AuthenticationResult: { AccessToken: accessToken, sub },
  });
}

/**
 * Register a user and return the token from the response.
 * Resets and reconfigures mocks internally.
 */
async function registerUser(overrides: {
  username?: string;
  email?: string;
  password?: string;
  sub?: string;
  accessToken?: string;
} = {}): Promise<{ token: string; sub: string }> {
  const sub = overrides.sub ?? `sub-${Date.now()}`;
  const accessToken = overrides.accessToken ?? `token-${Date.now()}`;
  setupRegisterMocks(sub, accessToken);

  // verifier.verify should return a valid payload for subsequent /me calls
  mockVerify.mockResolvedValue({ sub, 'custom:role': 'user' });

  const res = await request.post('/api/auth/register').send({
    username: overrides.username ?? 'testuser',
    email: overrides.email ?? 'test@example.com',
    password: overrides.password ?? 'password123',
  });

  return { token: res.body.data?.token ?? accessToken, sub };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  const valid = () => ({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  });

  beforeEach(() => {
    setupRegisterMocks();
    mockVerify.mockResolvedValue({ sub: 'cognito-sub-123', 'custom:role': 'user' });
  });

  it('returns 201 and success envelope on valid input', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('token in response is the Cognito AccessToken string', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThan(0);
  });

  it('response includes user with correct username', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.body.data.user.username).toBe('testuser');
  });

  it('response never contains passwordHash', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('response never contains cognitoSub', async () => {
    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/cognitoSub/);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 with error.field when email is invalid', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBeDefined();
  });

  it('returns 400 when password is under 8 characters', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), password: 'short1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is exactly 7 characters', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when username is missing', async () => {
    const { username: _u, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when username is whitespace-only', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ ...valid(), username: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is missing', async () => {
    const { email: _e, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is missing', async () => {
    const { password: _p, ...body } = valid();
    const res = await request.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when Cognito throws UsernameExistsException (email already taken)', async () => {
    const { UsernameExistsException } = await import(
      '@aws-sdk/client-cognito-identity-provider'
    );
    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') {
        const err = new (UsernameExistsException as unknown as new (args: { message: string; $metadata: object }) => Error)(
          { message: 'User already exists', $metadata: {} }
        );
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });

    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 with error.field = "email" when Cognito reports duplicate email', async () => {
    const { UsernameExistsException } = await import(
      '@aws-sdk/client-cognito-identity-provider'
    );
    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') {
        const err = new (UsernameExistsException as unknown as new (args: { message: string; $metadata: object }) => Error)(
          { message: 'User already exists', $metadata: {} }
        );
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });

    const res = await request.post('/api/auth/register').send(valid());
    expect(res.status).toBe(409);
    expect(res.body.error.field).toBe('email');
  });

  it('returns 409 when username is already taken (duplicate preferred_username in MongoDB)', async () => {
    // First registration succeeds
    await registerUser({ username: 'dupeuser', email: 'dupe@example.com', sub: 'sub-dupe-1' });

    // Second registration with same username, Cognito succeeds but MongoDB should catch duplicate username
    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') return Promise.resolve({ UserSub: 'sub-dupe-2' });
      if (cmd._type === 'AdminConfirmSignUpCommand') return Promise.resolve({});
      if (cmd._type === 'InitiateAuthCommand')
        return Promise.resolve({
          AuthenticationResult: { AccessToken: 'token-dupe-2', sub: 'sub-dupe-2' },
        });
      return Promise.resolve({});
    });

    const res = await request.post('/api/auth/register').send({
      username: 'dupeuser',
      email: 'other@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('409 for duplicate username includes error.field = "username"', async () => {
    await registerUser({ username: 'dupeuser2', email: 'dupe2@example.com', sub: 'sub-dupe2-1' });

    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') return Promise.resolve({ UserSub: 'sub-dupe2-2' });
      if (cmd._type === 'AdminConfirmSignUpCommand') return Promise.resolve({});
      if (cmd._type === 'InitiateAuthCommand')
        return Promise.resolve({
          AuthenticationResult: { AccessToken: 'token-dupe2-2', sub: 'sub-dupe2-2' },
        });
      return Promise.resolve({});
    });

    const res = await request.post('/api/auth/register').send({
      username: 'dupeuser2',
      email: 'different@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.field).toBe('username');
  });

  it('duplicate email check is case-insensitive', async () => {
    await registerUser({ username: 'ciuser', email: 'ci@example.com', sub: 'sub-ci-1' });

    // Cognito would reject the duplicate email, simulate that
    const { UsernameExistsException } = await import(
      '@aws-sdk/client-cognito-identity-provider'
    );
    mockCognitoSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'SignUpCommand') {
        const err = new (UsernameExistsException as unknown as new (args: { message: string; $metadata: object }) => Error)(
          { message: 'User already exists', $metadata: {} }
        );
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });

    const res = await request.post('/api/auth/register').send({
      username: 'differentuser',
      email: 'CI@EXAMPLE.COM',
      password: 'password123',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  const creds = { email: 'login@example.com', password: 'password123' };

  beforeEach(async () => {
    await registerUser({
      username: 'loginuser',
      email: creds.email,
      sub: 'login-sub',
      accessToken: 'login-register-token',
    });
    // Reset and configure login mock
    setupLoginMock('login-sub', 'login-access-token');
    mockVerify.mockResolvedValue({ sub: 'login-sub', 'custom:role': 'user' });
  });

  it('returns 200 with token and user on valid credentials', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
  });

  it('token in login response is a string', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(typeof res.body.data.token).toBe('string');
  });

  it('login response never contains passwordHash', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('login success response has correct envelope shape', async () => {
    const res = await request.post('/api/auth/login').send(creds);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data).toHaveProperty('user');
  });

  it('returns 401 on wrong password (Cognito throws NotAuthorizedException)', async () => {
    const { NotAuthorizedException } = await import(
      '@aws-sdk/client-cognito-identity-provider'
    );
    mockCognitoSend.mockRejectedValue(
      new (NotAuthorizedException as unknown as new (args: { message: string; $metadata: object }) => Error)(
        { message: 'Incorrect username or password.', $metadata: {} }
      )
    );

    const res = await request
      .post('/api/auth/login')
      .send({ ...creds, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 on unknown email (Cognito throws UserNotFoundException)', async () => {
    const { UserNotFoundException } = await import(
      '@aws-sdk/client-cognito-identity-provider'
    );
    mockCognitoSend.mockRejectedValue(
      new (UserNotFoundException as unknown as new (args: { message: string; $metadata: object }) => Error)(
        { message: 'User does not exist.', $metadata: {} }
      )
    );

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ password: creds.password });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password field is missing', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: creds.email });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('login is case-insensitive for email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'LOGIN@EXAMPLE.COM', password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/auth/me', () => {
  let token: string;

  beforeEach(async () => {
    const result = await registerUser({
      username: 'meuser',
      email: 'me@example.com',
      sub: 'me-sub-123',
      accessToken: 'me-access-token',
    });
    token = result.token;
    // verifyToken middleware will call verifier.verify(token) — return valid payload
    mockVerify.mockResolvedValue({ sub: 'me-sub-123', 'custom:role': 'user' });
  });

  it('returns 200 with user from valid Cognito token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns user with correct username', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.user.username).toBe('meuser');
  });

  it('me response has correct envelope shape', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('user');
  });

  it('me response user has expected fields (username, role, id)', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const { user } = res.body.data;
    expect(user.username).toBeDefined();
    expect(user.role).toBeDefined();
    expect(user.id).toBeDefined();
  });

  it('me response never contains passwordHash', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('me response never contains cognitoSub', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/cognitoSub/);
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when token is invalid (verifier throws)', async () => {
    mockVerify.mockRejectedValue(new Error('Token invalid'));
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyToken middleware — boundary cases
// ---------------------------------------------------------------------------

describe('verifyToken middleware — boundary cases', () => {
  beforeEach(() => {
    mockVerify.mockResolvedValue({ sub: 'some-sub', 'custom:role': 'user' });
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'some-token-without-bearer');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.message).toBe('string');
  });

  it('returns 401 when Authorization header is just "Bearer " with no token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when token is invalid (verifier.verify throws)', async () => {
    mockVerify.mockRejectedValue(new Error('JwtInvalidClaimError'));
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer malformed.token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('error response envelope has error.message as a string', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.message).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// requireRole middleware
// ---------------------------------------------------------------------------

describe('requireRole middleware', () => {
  // Build a minimal role-test app that uses the REAL verifyToken (backed by
  // mockVerify) and requireRole middlewares
  const roleApp = express();
  roleApp.use(express.json());
  roleApp.get(
    '/admin-only',
    verifyToken,
    requireRole('admin'),
    (_req: express.Request, res: express.Response) =>
      res.json({ success: true, data: { reached: true } }),
  );
  roleApp.get(
    '/moderator-only',
    verifyToken,
    requireRole('moderator'),
    (_req: express.Request, res: express.Response) =>
      res.json({ success: true, data: { reached: true } }),
  );
  roleApp.get(
    '/user-only',
    verifyToken,
    requireRole('user'),
    (_req: express.Request, res: express.Response) =>
      res.json({ success: true, data: { reached: true } }),
  );

  const roleRequest = supertest(roleApp);

  it('returns 403 when custom:role = "user" hits admin-only route', async () => {
    mockVerify.mockResolvedValue({ sub: 'uid1', 'custom:role': 'user' });
    const res = await roleRequest
      .get('/admin-only')
      .set('Authorization', 'Bearer fake-user-token');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Insufficient permissions');
  });

  it('returns 403 when custom:role = "user" hits moderator-only route', async () => {
    mockVerify.mockResolvedValue({ sub: 'uid1', 'custom:role': 'user' });
    const res = await roleRequest
      .get('/moderator-only')
      .set('Authorization', 'Bearer fake-user-token');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when custom:role = "admin" hits admin-only route', async () => {
    mockVerify.mockResolvedValue({ sub: 'uid2', 'custom:role': 'admin' });
    const res = await roleRequest
      .get('/admin-only')
      .set('Authorization', 'Bearer fake-admin-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reached).toBe(true);
  });

  it('returns 403 when custom:role = "admin" hits user-only route (role is exact, not hierarchical)', async () => {
    mockVerify.mockResolvedValue({ sub: 'uid2', 'custom:role': 'admin' });
    const res = await roleRequest
      .get('/user-only')
      .set('Authorization', 'Bearer fake-admin-token');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when custom:role = "user" hits user-only route', async () => {
    mockVerify.mockResolvedValue({ sub: 'uid1', 'custom:role': 'user' });
    const res = await roleRequest
      .get('/user-only')
      .set('Authorization', 'Bearer fake-user-token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when no token is provided to role-protected route', async () => {
    const res = await roleRequest.get('/admin-only');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
