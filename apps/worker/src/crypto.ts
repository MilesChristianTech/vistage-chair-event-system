import { createDecipheriv } from 'crypto';

// Mirrors apps/web/src/lib/crypto.ts's format exactly. Duplicated rather
// than shared via a package because the worker is deployed as its own
// process (Railway) separate from the Next.js app (Vercel) - see Part 2.1.
// The worker only ever needs to decrypt (the Host's browser session, via
// the Next.js app, is what encrypts a token at connect time).

export function decryptSecret(encoded: string): string {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set.');
  const key = Buffer.from(raw, 'base64');

  const [ivB64, tagB64, ciphertextB64] = encoded.split(':');
  if (!ivB64 || !tagB64 || !ciphertextB64) throw new Error('Malformed encrypted secret.');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
