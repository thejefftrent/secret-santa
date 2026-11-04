import { isAdminName } from '../../lib/admin.js';
import { clientIp, forgiveAttempt, hashPassword, reserveAttempt, startSession, textMatches } from '../../lib/auth.js';
import { normalizeCode } from '../../lib/codes.js';
import { HttpError, json, readJson } from '../../lib/http.js';
import { isUniqueViolation } from '../../lib/lists.js';
import { password, personName } from '../../lib/validate.js';

// Create an account for someone on the family list. You need your own family
// group's sign-up code (the organizer sees them on the Admin page), so nobody can
// claim a name in another family group. Organizers (names in ADMINS) can only
// sign up with SETUP_CODE, a Cloudflare secret, so nobody else can claim an
// organizer's name and see who has whom.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const name = personName(body.name);
  const pw = password(body.password);
  const code = normalizeCode(body.familyCode);

  const person = await env.DB.prepare(
    `SELECT p.id, p.name, p.household, a.person_id AS taken, c.code AS familyCode
       FROM people p
       LEFT JOIN accounts a ON a.person_id = p.id
       LEFT JOIN household_codes c ON c.household = p.household
      WHERE p.name = ?`,
  )
    .bind(name)
    .first();
  if (!person) throw new HttpError(404, `${name} isn't on the family list yet. Ask someone in your household to add you.`);
  if (person.taken) throw new HttpError(409, `${person.name} already has an account. Try signing in instead.`);

  const attempt = await reserveAttempt(env.DB, [
    { key: `signup-ip:${clientIp(request)}`, limit: 10, minutes: 15 },
    { key: `signup-family:${person.household}`, limit: 20, minutes: 60 },
  ]);
  const organizer = isAdminName(env, person.name);
  const expected = organizer ? normalizeCode(env.SETUP_CODE ?? '') : person.familyCode;
  if (!code || !expected || !(await textMatches(code, expected))) {
    throw new HttpError(
      403,
      organizer
        ? 'Organizers sign up with the setup code (SETUP_CODE), not a family code.'
        : "That family code isn't right. Each family group has its own code; ask the organizer for yours.",
    );
  }
  await forgiveAttempt(env.DB, attempt);

  try {
    await env.DB.prepare('INSERT INTO accounts (person_id, password_hash) VALUES (?, ?)')
      .bind(person.id, await hashPassword(pw))
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `${person.name} already has an account. Try signing in instead.`);
    throw err;
  }

  const cookie = await startSession(env.DB, request, person.id);
  return json({ ok: true }, { status: 201, headers: { 'Set-Cookie': cookie } });
}
