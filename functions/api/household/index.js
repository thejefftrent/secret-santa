import { HttpError, json, readJson } from '../../../lib/http.js';
import { isAdminName } from '../../../lib/admin.js';
import { isUniqueViolation, requireAdult } from '../../../lib/lists.js';
import { personName } from '../../../lib/validate.js';

const MAX_HOUSEHOLD_SIZE = 12;

// Adults only: add someone (a new baby, a partner) to your household so they get a list.
// Body: { name, isKid } (isKid defaults to true).
export async function onRequestPost({ request, env, data }) {
  const user = await data.requireUser();
  requireAdult(user);
  const body = await readJson(request);
  const name = personName(body.name);
  const isKid = body.isKid !== false;
  if (isAdminName(env, name)) throw new HttpError(400, `${name} is the organizer's name. Ask the organizer to add them.`);

  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM people WHERE household = ?')
    .bind(user.household)
    .first();
  if (n >= MAX_HOUSEHOLD_SIZE) throw new HttpError(400, 'Your household is full.');

  try {
    const person = await env.DB.prepare(
      'INSERT INTO people (name, household, is_kid) VALUES (?, ?, ?) RETURNING id, name',
    )
      .bind(name, user.household, isKid ? 1 : 0)
      .first();
    return json({ person: { ...person, isKid, hasAccount: false, items: [], shareToken: null } }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `Someone called ${name} is already on the family list.`);
    throw err;
  }
}
