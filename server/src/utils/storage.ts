import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Any S3-compatible provider (Cloudflare R2 today, Backblaze B2 as the fallback) — swapped by env only
let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY as string,
    },
  });
  return client;
}

const bucket = () => process.env.STORAGE_BUCKET as string;

export const SIGNED_URL_SECONDS = 3600;

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function removeObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export function signedUrl(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: SIGNED_URL_SECONDS });
}

export async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }));
    keys.push(...(page.Contents ?? []).map((o) => o.Key as string));
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}
