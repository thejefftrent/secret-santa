import { HttpError, json, readJson } from '../../../lib/http.js';
import { canManage } from '../../../lib/lists.js';
import { id, itemLink, itemText } from '../../../lib/validate.js';

async function requireOwnItem(env, user, itemId) {
  const item = await env.DB.prepare(
    'SELECT i.id, p.id AS personId, p.household FROM items i JOIN people p ON p.id = i.person_id WHERE i.id = ?',
  )
    .bind(itemId)
    .first();
  if (!item || !canManage(user, { id: item.personId, household: item.household })) {
    throw new HttpError(404, "That wish isn't on one of your lists.");
  }
}

export async function onRequestPut({ request, env, data, params }) {
  const user = await data.requireUser();
  const itemId = id(params.id, 'wish');
  const body = await readJson(request);
  const text = itemText(body.text);
  const link = itemLink(body.link);
  await requireOwnItem(env, user, itemId);

  const item = await env.DB.prepare(
    `UPDATE items SET text = ?, link = ?, updated_at = datetime('now') WHERE id = ?
     RETURNING id, person_id AS personId, text, link`,
  )
    .bind(text, link, itemId)
    .first();
  return json({ item });
}

export async function onRequestDelete({ env, data, params }) {
  const user = await data.requireUser();
  const itemId = id(params.id, 'wish');
  await requireOwnItem(env, user, itemId);
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(itemId).run();
  return json({ ok: true });
}
