import { isAdminName, requireAdmin } from '../../lib/admin.js';
import { clientIp, forgiveAttempt, reserveAttempt, startSession, textMatches } from '../../lib/auth.js';
import { HttpError, json, readJson } from '../../lib/http.js';
import { id } from '../../lib/validate.js';

// Organizer only: sign in as someone else, to see the site as they do or fix
// their list for them. Besides the organizer's own sign-in, it needs ADMIN_PASS,
// a Cloudflare secret. This browser's session becomes a one-hour session as that
// person that remembers which organizer started it; DELETE switches back.
export async function onRequestPost({ request, env, data }) {
  const admin = await requireAdmin(env, data);
  const body = await readJson(request);
  const personId = id(body.personId, 'person');

  const person = await env.DB.prepare(
    `SELECT p.id, p.name, (a.person_id IS NOT NULL) AS hasAccount
       FROM people p LEFT JOIN accounts a ON a.person_id = p.id
      WHERE p.id = ?`,
  )
    .bind(personId)
    .first();
  if (!person) throw new HttpError(404, "That person isn't on the family list anymore. Reload the page.");
  if (person.id === admin.id) throw new HttpError(400, "You're already signed in as yourself.");
  // Another organizer would get the Admin page back, and could sign in as someone else in turn.
  if (isAdminName(env, person.name)) throw new HttpError(400, `${person.name} is an organizer, so you can't sign in as them.`);
  if (!person.hasAccount) {
    throw new HttpError(400, `${person.name} doesn't have an account yet. Edit their list from an adult in their family group instead.`);
  }

  const expected = typeof env.ADMIN_PASS === 'string' ? env.ADMIN_PASS : '';
  if (!expected) {
    throw new HttpError(503, "Signing in as someone else needs the ADMIN_PASS secret, and it isn't set on this site.");
  }
  // Counted before checking, like sign-in, so a stolen organizer session can't guess it quickly.
  const organizerKey = `admin-pass:${admin.id}`;
  const attempt = await reserveAttempt(env.DB, [
    { key: organizerKey, limit: 5, minutes: 60 },
    { key: `admin-pass-ip:${clientIp(request)}`, limit: 10, minutes: 60 },
  ]);
  const given = typeof body.adminPass === 'string' ? body.adminPass : '';
  if (!given || !(await textMatches(given, expected))) throw new HttpError(403, "That admin password isn't right.");
  // Like sign-in: the right password also clears this organizer's earlier typos.
  await forgiveAttempt(env.DB, attempt, [organizerKey]);

  console.log(`${admin.name} (#${admin.id}) signed in as ${person.name} (#${person.id})`);
  const cookie = await startSession(env.DB, request, person.id, { impersonatorId: admin.id });
  return json({ ok: true, name: person.name }, { headers: { 'Set-Cookie': cookie } });
}

// Back to the organizer's own account, from a session started above.
export async function onRequestDelete({ request, env, data }) {
  const user = await data.requireUser();
  if (!user.impersonatedBy) throw new HttpError(400, "You're not signed in as someone else.");
  const cookie = await startSession(env.DB, request, user.impersonatedBy.id);
  return json({ ok: true, name: user.impersonatedBy.name }, { headers: { 'Set-Cookie': cookie } });
}
