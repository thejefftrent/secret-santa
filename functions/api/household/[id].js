import { currentDraw, isAdminName } from '../../../lib/admin.js';
import { HttpError, json } from '../../../lib/http.js';
import { requireAdult, requireManaged } from '../../../lib/lists.js';
import { id } from '../../../lib/validate.js';

// Adults only: remove someone from your household (e.g. a typo). Only people without their
// own account, and not in this year's draw, can be removed; their wishes go with them.
export async function onRequestDelete({ env, data, params }) {
  const user = await data.requireUser();
  requireAdult(user);
  const personId = id(params.id, 'person');
  const person = await requireManaged(env.DB, user, personId);
  if (person.id === user.id) throw new HttpError(400, "You can't remove yourself.");
  if (isAdminName(env, person.name)) throw new HttpError(400, `${person.name} is the organizer, so they can't be removed here.`);

  const account = await env.DB.prepare('SELECT 1 FROM accounts WHERE person_id = ?').bind(personId).first();
  if (account) throw new HttpError(400, `${person.name} has their own account, so they can't be removed here.`);

  const draw = await currentDraw(env.DB);
  if (draw) {
    const inDraw = await env.DB.prepare(
      'SELECT 1 FROM assignments WHERE draw_id = ? AND (giver_id = ? OR giftee_id = ?)',
    )
      .bind(draw.id, personId, personId)
      .first();
    if (inDraw) throw new HttpError(400, `${person.name} is in the ${draw.year} Secret Santa draw, so they can't be removed.`);
  }

  await env.DB.prepare('DELETE FROM people WHERE id = ?').bind(personId).run();
  return json({ ok: true });
}
