'use strict';

const { execSync } = require('child_process');
const path = require('path');
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const E2E_ACCOUNTS = [
  { email: 'e2e-admin@test.local', password: 'E2ePassword1!', role: 'admin' },
  { email: 'e2e-mod@test.local',   password: 'E2ePassword1!', role: 'moderator' },
  { email: 'e2e-user@test.local',  password: 'E2ePassword1!', role: 'user' },
];

module.exports = async function globalSetup() {
  // Seed Cognito + MongoDB users
  const script = path.resolve(__dirname, '../server/src/scripts/seedE2EAdmin.js');
  execSync(`node "${script}"`, { stdio: 'inherit' });

  // Obtain Cognito access tokens for each test role
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
  });

  for (const account of E2E_ACCOUNTS) {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: account.email,
        PASSWORD: account.password,
      },
    }));
    const accessToken = result.AuthenticationResult?.AccessToken;
    if (accessToken) {
      process.env[`E2E_TOKEN_${account.role.toUpperCase()}`] = accessToken;
    }
  }
};
