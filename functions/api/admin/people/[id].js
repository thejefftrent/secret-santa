import {
  currentDraw,
  inCurrentDraw,
  isAdminName,
  newHouseholdId,
  requireAdmin,
  requireHousehold,
} from '../../../../lib/admin.js';
import { HttpError, json, readJson } from '../../../../lib/http.js';
import { isUniqueViolation } from '../../../../lib/lists.js';
import { id, personName } from '../../../../lib/validate.js';

async function loadPerson(db, personId) {
  const person = await db
    .prepare('SELECT id, name, household, is_kid AS isKid FROM people WHERE id = ?')
    .bind(personId)
    .first();
  if (!person) throw new HttpError(404, "That person isn't on the family list anymore. Reload the page.");
  return person;
}

// Organizer only: rename someone, move them to another family group, and/or mark them as a kid.
// Body: { name?, household?, isKid? } where household is an existing group id, or null for a new group.
export async function onRequestPatch({ request, env, data, params }) {
  await requireAdmin(env, data);
  const person = await loadPerson(env.DB, id(params.id, 'person'));
  const body = await readJson(request);

  const name = 'name' in body ? personName(body.name) : person.name;
  if (name.toLowerCase() !== person.name.toLowerCase() && isAdminName(env, name)) {
    throw new HttpError(400, `${name} is listed in ADMINS, so they'd get the Admin page. Use a different name, or change ADMINS first.`);
  }
  if (name.toLowerCase() !== person.name.toLowerCase() && isAdminName(env, person.name)) {
    throw new HttpError(
      400,
      `${person.name} is an organizer, and organizers are listed by name in ADMINS (wrangler.toml). Change ADMINS first so they don't lose access.`,
    );
  }

  let household = person.household;
  if ('household' in body) {
    household = body.household === null ? await newHouseholdId(env.DB, name) : await requireHousehold(env.DB, body.household);
  }

  if ('isKid' in body && typeof body.isKid !== 'boolean') throw new HttpError(400, 'isKid must be true or false.');
  const isKid = 'isKid' in body ? body.isKid : Boolean(person.isKid);

  try {
    await env.DB.prepare('UPDATE people SET name = ?, household = ?, is_kid = ? WHERE id = ?')
      .bind(name, household, isKid ? 1 : 0, person.id)
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, `Someone called ${name} is already on the family list.`);
    throw err;
  }

  // Moving people can put a giver and their giftee in the same group. Say how many, not who.
  let warning = null;
  const draw = household !== person.household ? await currentDraw(env.DB) : null;
  if (draw) {
    const { n } = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM assignments a
         JOIN people g ON g.id = a.giver_id JOIN people r ON r.id = a.giftee_id
        WHERE a.draw_id = ? AND g.household = r.household`,
    )
      .bind(draw.id)
      .first();
    if (n) {
      warning = `Heads up: ${n} ${n === 1 ? 'person' : 'people'} in the ${draw.year} draw now ${n === 1 ? 'gives' : 'give'} to someone in their own family group. Draw ${draw.year} again if that matters.`;
    }
  }
  return json({ person: { id: person.id, name, household, isKid }, warning });
}

// Organizer only: remove someone completely (their account, wishes and share link go too).
export async function onRequestDelete({ env, data, params }) {
  const user = await requireAdmin(env, data);
  const person = await loadPerson(env.DB, id(params.id, 'person'));
  if (person.id === user.id) throw new HttpError(400, "You can't remove yourself.");
  if (isAdminName(env, person.name)) throw new HttpError(400, `${person.name} is an organizer. Take them out of ADMINS first.`);
  const year = await inCurrentDraw(env.DB, person.id);
  if (year) {
    throw new HttpError(400, `${person.name} is in the ${year} draw. Draw ${year} again without them first, then remove them.`);
  }
  await env.DB.prepare('DELETE FROM people WHERE id = ?').bind(person.id).run();
  return json({ ok: true });
}
