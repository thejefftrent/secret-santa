import { HttpError, json } from '../../../lib/http.js';
import { itemsFor } from '../../../lib/lists.js';

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

// Public, read-only: one person's list, for whoever holds their share link.
export async function onRequestGet({ env, params }) {
  const token = String(params.token);
  const person =
    TOKEN.test(token) &&
    (await env.DB.prepare(
      'SELECT p.id, p.name FROM share_links s JOIN people p ON p.id = s.person_id WHERE s.token = ?',
    )
      .bind(token)
      .first());
  if (!person) throw new HttpError(404, "This link has been turned off or doesn't exist.");
  return json({ person: { name: person.name, items: await itemsFor(env.DB, person.id) } });
}
