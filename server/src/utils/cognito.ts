import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

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

// Cognito just issued the token, so a decode without re-verification is enough.
function decodeAccessTokenClaims(accessToken: string): { sub?: string; username?: string } | null {
  const parts = accessToken.split('.');
  if (parts.length < 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return { sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export { cognitoClient, USER_POOL_ID, CLIENT_ID, CLIENT_SECRET, secretHash, decodeAccessTokenClaims };
