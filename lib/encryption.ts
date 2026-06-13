/**
 * AES-256-GCM for provider API keys at rest. Key from ENCRYPTION_KEY (64-hex
 * preferred; any other string is SHA-256'd to 32 bytes). Format: iv.tag.data (b64).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? '';
  if (!raw) throw new Error('ENCRYPTION_KEY is not set');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
