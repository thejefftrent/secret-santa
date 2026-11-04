import { json } from '../../../lib/http.js';
import { requireManaged } from '../../../lib/lists.js';
import { id } from '../../../lib/validate.js';

// Turn off someone's share link. The old URL stops working immediately.
export async function onRequestDelete({ env, data, params }) {
  const user = await data.requireUser();
  const personId = id(params.personId, 'person');
  await requireManaged(env.DB, user, personId);
  await env.DB.prepare('DELETE FROM share_links WHERE person_id = ?').bind(personId).run();
  return json({ ok: true });
}
