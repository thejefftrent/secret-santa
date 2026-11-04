import { isAdminName, newHouseholdId, requireAdmin, requireHousehold } from '../../../../lib/admin.js';
import { HttpError, json, readJson } from '../../../../lib/http.js';
import { isUniqueViolation } from '../../../../lib/lists.js';
import { personName } from '../../../../lib/validate.js';

// Organizer only: add someone to a family group, or to a new one ({ household: null }). Body: { name, household, isKid }.
export async function onRequestPost({ request, env, data }) {
  await requireAdmin(env, data);
  const body = await readJson(request);
  const name = personName(body.name);
  if (isAdminName(env, name)) {
    throw new HttpError(400, `${name} is listed in ADMINS, so they'd get the Admin page. Use a different name, or change ADMINS first.`);
  }
  const household = body.household ? await requireHousehold(env.DB, body.household) : await newHouseholdId(env.DB, name);

  try {
    const person = await env.DB.prepare(
      'INSERT INTO people (name, household, is_kid) VALUES (?, ?, ?) RETURNING id, name, household, is_kid AS isKid',
    )
      .bind(name, household, body.isKid === true ? 1 : 0)
      .first();
    return json({ person: { ...person, isKid: Boolean(person.isKid) } }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `Someone called ${name} is already on the family list.`);
    throw err;
  }
}
