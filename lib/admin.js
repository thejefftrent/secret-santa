import { newFamilyCode } from './codes.js';
import { HttpError } from './http.js';

/**
 * Organizers are listed by name in the ADMINS variable (wrangler.toml), comma-separated.
 * An organizer signed in as someone else isn't one until they switch back.
 */
export function isAdmin(env, user) {
  if (!user || user.impersonatedBy) return false;
  const admins = String(env.ADMINS ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.name.toLowerCase());
}

export async function requireAdmin(env, data) {
  const user = await data.requireUser();
  if (user.impersonatedBy) {
    throw new HttpError(403, `You're signed in as ${user.name}. Go back to ${user.impersonatedBy.name} first (the organizer's own account).`);
  }
  if (!isAdmin(env, user)) throw new HttpError(403, 'Only the Secret Santa organizer can do that.');
  return user;
}

/** The newest draw ({ id, year }) or null. */
export function currentDraw(db) {
  return db.prepare('SELECT id, year, created_at AS createdAt FROM draws ORDER BY year DESC LIMIT 1').first();
}

/** Is this name one of the organizers in ADMINS? */
export function isAdminName(env, name) {
  return isAdmin(env, { name });
}

/** Throws 400 unless some person already belongs to this household. */
export async function requireHousehold(db, household) {
  if (typeof household !== 'string' || !household) throw new HttpError(400, 'Pick a family group.');
  const row = await db.prepare('SELECT 1 FROM people WHERE household = ? LIMIT 1').bind(household).first();
  if (!row) throw new HttpError(400, "That family group doesn't exist anymore. Reload the page.");
  return household;
}

/** A household id that nobody uses yet, based on a name ("Sam" -> "sam", then "sam-2", ...). */
export async function newHouseholdId(db, name) {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'family';
  const { results } = await db
    .prepare("SELECT DISTINCT household FROM people WHERE household = ? OR household LIKE ? || '-%'")
    .bind(base, base)
    .all();
  const taken = new Set(results.map((r) => r.household));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Is this person a giver or giftee in the newest draw? Returns the draw year, or null. */
export async function inCurrentDraw(db, personId) {
  const draw = await currentDraw(db);
  if (!draw) return null;
  const row = await db
    .prepare('SELECT 1 FROM assignments WHERE draw_id = ? AND (giver_id = ? OR giftee_id = ?)')
    .bind(draw.id, personId, personId)
    .first();
  return row ? draw.year : null;
}

/**
 * Every family group's sign-up code (Map household -> code). Makes codes for
 * groups that don't have one yet, and drops codes for groups nobody is in.
 */
export async function familyCodes(db) {
  const [groups, existing] = await db.batch([
    db.prepare('SELECT DISTINCT household FROM people'),
    db.prepare('SELECT household, code FROM household_codes'),
  ]);
  const live = new Set(groups.results.map((g) => g.household));
  const used = new Set(existing.results.map((r) => r.code));
  const have = new Set(existing.results.map((r) => r.household));
  const writes = [];
  for (const household of live) {
    if (have.has(household)) continue;
    let code;
    do code = newFamilyCode();
    while (used.has(code));
    used.add(code);
    writes.push(
      db.prepare('INSERT INTO household_codes (household, code) VALUES (?, ?) ON CONFLICT (household) DO NOTHING').bind(household, code),
    );
  }
  if (existing.results.some((r) => !live.has(r.household))) {
    writes.push(db.prepare('DELETE FROM household_codes WHERE household NOT IN (SELECT DISTINCT household FROM people)'));
  }
  if (writes.length) await db.batch(writes);
  const { results } = await db.prepare('SELECT household, code FROM household_codes').all();
  return new Map(results.map((r) => [r.household, r.code]));
}
