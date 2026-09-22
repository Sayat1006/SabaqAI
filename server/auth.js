import crypto from 'node:crypto';

const SCRYPT_N = 16384;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: SCRYPT_N });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: SCRYPT_N });
  return crypto.timingSafeEqual(expected, actual);
}

/** Readable temporary password, e.g. "sabaq-7kq4-m2xp". */
export function generateTempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');
  return `sabaq-${pick(4)}-${pick(4)}`;
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Very small in-memory limiter for login attempts: 10 per 15 minutes per key. */
const attempts = new Map();
export function loginRateLimited(key) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const list = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  return list.length > 10;
}
export function resetLoginAttempts(key) {
  attempts.delete(key);
}
