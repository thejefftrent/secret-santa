import { randomToken } from '../../../lib/auth.js';
import { json, readJson } from '../../../lib/http.js';
import { requireManaged } from '../../../lib/lists.js';
import { id } from '../../../lib/validate.js';

// Turn on (or replace) the read-only share link for someone you manage (see canManage).
// Replacing gives a new token, so the old link stops working.
export async function onRequestPost({ request, env, data }) {
  const user = await data.requireUser();
  const personId = id((await readJson(request)).personId, 'person');
  await requireManaged(env.DB, user, personId);

  const token = randomToken();
  await env.DB.prepare(
    `INSERT INTO share_links (person_id, token, created_by) VALUES (?, ?, ?)
     ON CONFLICT (person_id) DO UPDATE SET token = excluded.token, created_by = excluded.created_by,
       created_at = datetime('now')`,
  )
    .bind(personId, token, user.id)
    .run();
  return json({ shareToken: token }, { status: 201 });
}
