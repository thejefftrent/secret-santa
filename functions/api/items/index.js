import { HttpError, json, readJson } from '../../../lib/http.js';
import { requireManaged } from '../../../lib/lists.js';
import { id, itemLink, itemText } from '../../../lib/validate.js';

const MAX_ITEMS_PER_PERSON = 50;

// Add a wish to a list you manage (your own, or anyone in your household if you're an adult).
export async function onRequestPost({ request, env, data }) {
  const user = await data.requireUser();
  const body = await readJson(request);
  const personId = id(body.personId, 'person');
  const text = itemText(body.text);
  const link = itemLink(body.link);
  const person = await requireManaged(env.DB, user, personId);

  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE person_id = ?').bind(personId).first();
  if (n >= MAX_ITEMS_PER_PERSON) {
    throw new HttpError(400, `${person.name}'s list is full (${MAX_ITEMS_PER_PERSON} wishes). Remove one first.`);
  }

  const item = await env.DB.prepare(
    'INSERT INTO items (person_id, text, link) VALUES (?, ?, ?) RETURNING id, person_id AS personId, text, link',
  )
    .bind(personId, text, link)
    .first();
  return json({ item }, { status: 201 });
}
