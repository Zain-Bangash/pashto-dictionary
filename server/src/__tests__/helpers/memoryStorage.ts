// Stands in for utils/storage in tests: files live in a Map, and removes can be made to fail
export const files = new Map<string, Buffer>();
export const failures = { remove: false };
export const SIGNED_URL_SECONDS = 3600;

export async function putObject(key: string, body: Buffer): Promise<void> {
  files.set(key, body);
}

export async function removeObject(key: string): Promise<void> {
  if (failures.remove) throw new Error('storage unavailable');
  files.delete(key);
}

export async function signedUrl(key: string): Promise<string> {
  return `https://storage.test/${key}?signature=test`;
}

export async function listKeys(prefix: string): Promise<string[]> {
  return [...files.keys()].filter((k) => k.startsWith(prefix));
}
