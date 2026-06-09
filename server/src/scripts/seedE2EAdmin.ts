'use strict';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import User from '../models/User';

const E2E_PASSWORD = 'E2ePassword1!';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-1';

const ACCOUNTS: Array<{ username: string; email: string; role: 'admin' | 'moderator' | 'user' }> = [
  { username: 'e2e-admin', email: 'e2e-admin@test.local', role: 'admin' },
  { username: 'e2e-mod',   email: 'e2e-mod@test.local',   role: 'moderator' },
  { username: 'e2e-user',  email: 'e2e-user@test.local',  role: 'user' },
];

const cognitoClient = new CognitoIdentityProviderClient({ region: AWS_REGION });

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);

  for (const account of ACCOUNTS) {
    let cognitoSub: string | undefined;

    // Create user in Cognito
    try {
      const createResult = await cognitoClient.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: account.email,
        TemporaryPassword: 'Temp1234!',
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: account.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'preferred_username', Value: account.username },
        ],
      }));
      cognitoSub = createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;

      // Set permanent password
      await cognitoClient.send(new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: account.email,
        Password: E2E_PASSWORD,
        Permanent: true,
      }));

      // Set custom:role attribute
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: account.email,
        UserAttributes: [{ Name: 'custom:role', Value: account.role }],
      }));

      process.stdout.write(`[seedE2EAdmin] Cognito user created: ${account.email}\n`);
    } catch (err) {
      if (err instanceof UsernameExistsException) {
        process.stdout.write(`[seedE2EAdmin] Cognito user already exists: ${account.email}\n`);
        // cognitoSub will be resolved from MongoDB below
      } else {
        throw err;
      }
    }

    // Upsert MongoDB user
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      if (cognitoSub && !existing.cognitoSub) {
        existing.cognitoSub = cognitoSub;
        await existing.save();
      }
      process.stdout.write(`[seedE2EAdmin] MongoDB user already exists: ${account.email}\n`);
    } else {
      await new User({
        username: account.username,
        email: account.email,
        cognitoSub: cognitoSub ?? `placeholder-${account.email}`,
        role: account.role,
      }).save();
      process.stdout.write(`[seedE2EAdmin] MongoDB user created: ${account.email}\n`);
    }
  }

  await mongoose.disconnect();
}

seed().catch((err: Error) => {
  process.stderr.write(`[seedE2EAdmin] Error: ${err.message}\n`);
  process.exit(1);
});
