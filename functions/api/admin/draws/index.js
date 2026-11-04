import { requireAdmin } from '../../../../lib/admin.js';
import { DrawError, drawNames } from '../../../../lib/draw.js';
import { HttpError, json, readJson } from '../../../../lib/http.js';
import { id } from '../../../../lib/validate.js';

// Organizer only. GET: every year's draw (counts only). POST: draw names for a year.

export async function onRequestGet({ env, data }) {
  await requireAdmin(env, data);
  const { results } = await env.DB.prepare(
    `SELECT d.year, d.created_at AS createdAt, COUNT(a.id) AS people
       FROM draws d LEFT JOIN assignments a ON a.draw_id = d.id
      GROUP BY d.id ORDER BY d.year DESC`,
  ).all();
  return json({ draws: results });
}

export async function onRequestPost({ request, env, data }) {
  const user = await requireAdmin(env, data);
  const body = await readJson(request);

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, 'Pick a year like 2027.');
  if (!Array.isArray(body.participantIds)) throw new HttpError(400, 'Pick who is in the draw.');
  if (body.participantIds.length > 200) throw new HttpError(400, 'That is a lot of people!');
  const ids = [...new Set(body.participantIds.map((value) => id(value, 'person')))];

  const existing = await env.DB.prepare('SELECT id FROM draws WHERE year = ?').bind(year).first();
  if (existing && body.replace !== true) {
    throw new HttpError(409, `There's already a ${year} draw. Drawing again gives everyone a new person.`);
  }

  const { results: participants } = await env.DB.prepare(
    `SELECT id, name, household FROM people WHERE id IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(ids))
    .all();
  if (participants.length !== ids.length) throw new HttpError(400, 'Someone picked for the draw is no longer on the list.');

  // Compare with the most recent earlier year (not the draw being replaced).
  const { results: previous } = await env.DB.prepare(
    `SELECT a.giver_id AS giverId, a.giftee_id AS gifteeId,
            a.giver_household AS giverHousehold, a.giftee_household AS gifteeHousehold, d.year
       FROM assignments a JOIN draws d ON d.id = a.draw_id
      WHERE d.year = (SELECT MAX(year) FROM draws WHERE year < ?)`,
  )
    .bind(year)
    .all();

  let result;
  try {
    result = drawNames(participants, previous);
  } catch (err) {
    if (err instanceof DrawError) throw new HttpError(400, err.message);
    throw err;
  }

  // One batch = one transaction: the old draw for this year is only replaced if everything succeeds.
  const db = env.DB;
  await db.batch([
    db.prepare('DELETE FROM draws WHERE year = ?').bind(year),
    db.prepare('INSERT INTO draws (year, created_by) VALUES (?, ?)').bind(year, user.id),
    ...result.pairs.map(({ giver, giftee }) =>
      db
        .prepare(
          `INSERT INTO assignments
             (draw_id, giver_id, giftee_id, giver_name, giftee_name, giver_household, giftee_household)
           VALUES ((SELECT id FROM draws WHERE year = ?), ?, ?, ?, ?, ?, ?)`,
        )
        .bind(year, giver.id, giftee.id, giver.name, giftee.name, giver.household, giftee.household),
    ),
  ]);

  // Counts only: the organizer never sees who has whom.
  return json(
    {
      year,
      previousYear: previous[0]?.year ?? null,
      people: result.pairs.length,
      samePersonRepeats: result.samePersonRepeats,
      sameHouseholdRepeats: result.sameHouseholdRepeats,
    },
    { status: 201 },
  );
}
