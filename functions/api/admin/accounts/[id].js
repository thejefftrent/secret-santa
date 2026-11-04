import { isAdminName, requireAdmin } from '../../../../lib/admin.js';
import { HttpError, json } from '../../../../lib/http.js';
import { id } from '../../../../lib/validate.js';

// Organizer only: reset someone's sign-in (e.g. a forgotten password). Their
// account and sessions are deleted; their wishes stay. They sign up again with
// the family code.
export async function onRequestDelete({ env, data, params }) {
  const user = await requireAdmin(env, data);
  const personId = id(params.id, 'person');
  if (personId === user.id) throw new HttpError(400, 'Use "Change my password" on My Account instead.');
  const person = await env.DB.prepare('SELECT name FROM people WHERE id = ?').bind(personId).first();
  if (person && isAdminName(env, person.name)) {
    throw new HttpError(400, `${person.name} is an organizer. Take them out of ADMINS before resetting their sign-in.`);
  }
  const { meta } = await env.DB.prepare('DELETE FROM accounts WHERE person_id = ?').bind(personId).run();
  if (!meta.changes) throw new HttpError(404, "That person doesn't have an account.");
  return json({ ok: true });
}
