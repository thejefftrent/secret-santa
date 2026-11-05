import { HttpError } from './http.js';

// PBKDF2-SHA256. 25k iterations takes ~2.5 ms of CPU, so even a password change
// (check the old one, hash the new one) stays well under the Workers free plan's
// 10 ms-per-request CPU limit. The count is stored in each hash, so it can be
// raised later (e.g. on a paid plan) without breaking existing passwords.
const PBKDF2_ITERATIONS = 25_000;
const SESSION_SECONDS = 90 * 24 * 60 * 60;
// An organizer signed in as someone else: short, so it doesn't linger on their device.
const IMPERSONATION_SECONDS = 60 * 60;
const COOKIE_NAME = 'santa_session';
const MINUTE_MS = 60 * 1000;
// Failed attempts older than this are deleted; it must cover the longest throttle window.
const FAILURE_RETENTION_MS = 24 * 60 * MINUTE_MS;

const encoder = new TextEncoder();

function toBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random URL-safe token (16 bytes = 128 bits by default). */
export function randomToken(bytes = 16) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

function bytesEqual(a, b) {
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2-sha256') return false;
  const actual = await pbkdf2(password, fromBase64(salt), Number(iterations));
  return bytesEqual(actual, fromBase64(hash));
}

/** Constant-time string comparison (hashing first makes the lengths equal). */
export async function textMatches(a, b) {
  return bytesEqual(await sha256(a), await sha256(b));
}

async function tokenHash(token) {
  return toBase64(await sha256(token));
}

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function cookie(request, value, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/**
 * Starts a session as personId and returns the Set-Cookie header value. The new
 * cookie replaces this browser's old one, so the old session (if any) is ended
 * too. With impersonatorId, it's that organizer signed in as personId (who may
 * not have an account): a one-hour session that belongs to the organizer's
 * account and acts as personId (see functions/api/impersonation.js).
 */
export async function startSession(db, request, personId, { impersonatorId = null } = {}) {
  const token = randomToken(32);
  const now = Date.now();
  // sessions.person_id is always whoever signed in; as_person_id is who they act as.
  const owner = impersonatorId ?? personId;
  const asPerson = impersonatorId == null ? null : personId;
  const seconds = asPerson == null ? SESSION_SECONDS : IMPERSONATION_SECONDS;
  const statements = [
    db.prepare('DELETE FROM sessions WHERE person_id = ? AND expires_at < ?').bind(owner, now),
    db
      .prepare('INSERT INTO sessions (token_hash, person_id, expires_at, as_person_id) VALUES (?, ?, ?, ?)')
      .bind(await tokenHash(token), owner, now + seconds * 1000, asPerson),
  ];
  const old = readCookie(request, COOKIE_NAME);
  if (old) statements.unshift(db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await tokenHash(old)));
  await db.batch(statements);
  return cookie(request, token, seconds);
}

/** Ends the current session and returns the Set-Cookie header value that clears it. */
export async function endSession(db, request) {
  const token = readCookie(request, COOKIE_NAME);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await tokenHash(token)).run();
  return cookie(request, '', 0);
}

/**
 * Signs this person out everywhere: their own sign-ins (including anywhere they,
 * as an organizer, signed in as someone else) and any organizer signed in as them.
 */
export async function endAllSessions(db, personId) {
  await db.prepare('DELETE FROM sessions WHERE person_id = ?1 OR as_person_id = ?1').bind(personId).run();
}

/**
 * The signed-in person ({ id, name, household, isKid, impersonatedBy }) or null.
 * impersonatedBy is { id, name } of the organizer when they signed in as this
 * person, otherwise null.
 */
export async function currentUser(db, request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  // impersonator_id is set only on sessions where the previous version signed an
  // organizer in as someone (see migration 0007); they're never read as that person's own.
  const row = await db
    .prepare(
      `SELECT p.id, p.name, p.household, p.is_kid AS isKid,
              s.as_person_id AS asPersonId, s.person_id AS ownerId, o.name AS ownerName
         FROM sessions s
         JOIN people p ON p.id = COALESCE(s.as_person_id, s.person_id)
         LEFT JOIN people o ON o.id = s.person_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND s.impersonator_id IS NULL`,
    )
    .bind(await tokenHash(token), Date.now())
    .first();
  if (!row) return null;
  const { asPersonId, ownerId, ownerName, ...person } = row;
  return {
    ...person,
    isKid: Boolean(person.isKid),
    // Keyed on the session's column, not a join, so it can never read as an ordinary sign-in.
    impersonatedBy: asPersonId == null ? null : { id: ownerId, name: ownerName ?? 'the organizer' },
  };
}

/**
 * Counts this attempt against every limit *before* the secret is checked, in one
 * transaction, so a burst of parallel requests can't slip past. Each limit is
 * { key, limit, minutes }. Throws 429 if any limit is already used up. On a
 * correct secret, call forgiveAttempt() so the attempt doesn't count.
 */
export async function reserveAttempt(db, limits) {
  const now = Date.now();
  const results = await db.batch([
    db.prepare('DELETE FROM auth_failures WHERE at < ?').bind(now - FAILURE_RETENTION_MS),
    ...limits.map(({ key, limit, minutes }) =>
      db
        .prepare(
          `INSERT INTO auth_failures (key, at)
           SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM auth_failures WHERE key = ?1 AND at > ?3) < ?4`,
        )
        .bind(key, now, now - minutes * MINUTE_MS, limit),
    ),
  ]);
  const blocked = limits.find((_, i) => results[i + 1].meta.changes === 0);
  if (blocked) {
    const { minutes } = blocked;
    const wait = minutes >= 60 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`;
    throw new HttpError(429, `Too many tries. Please wait ${wait} and try again.`);
  }
  return { keys: limits.map((l) => l.key), at: now };
}

/** Undoes reserveAttempt() after a correct secret; also clears any extra keys given (e.g. this device's misses). */
export async function forgiveAttempt(db, attempt, clearKeys = []) {
  await db.batch([
    db
      .prepare('DELETE FROM auth_failures WHERE at = ? AND key IN (SELECT value FROM json_each(?))')
      .bind(attempt.at, JSON.stringify(attempt.keys)),
    ...clearKeys.map((key) => db.prepare('DELETE FROM auth_failures WHERE key = ?').bind(key)),
  ]);
}

/** The visitor's IP address as Cloudflare reports it ("local" in development). */
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}
