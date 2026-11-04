import { requireAdmin } from '../../../../lib/admin.js';
import { HttpError, json } from '../../../../lib/http.js';

function parseYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, 'Bad year.');
  return year;
}

// Organizer only: who has whom in one year's draw, and which pairings repeat
// the previous year (same person, or same family group to same family group).
export async function onRequestGet({ env, data, params }) {
  await requireAdmin(env, data);
  const year = parseYear(params.year);
  const draw = await env.DB.prepare('SELECT id FROM draws WHERE year = ?').bind(year).first();
  if (!draw) throw new HttpError(404, `There's no ${year} draw.`);

  const [pairs, previous] = await env.DB.batch([
    env.DB.prepare(
      `SELECT a.giver_id AS giverId, COALESCE(g.name, a.giver_name) AS giver,
              a.giftee_id AS gifteeId, COALESCE(r.name, a.giftee_name) AS giftee,
              a.giver_household AS giverHousehold, a.giftee_household AS gifteeHousehold
         FROM assignments a
         LEFT JOIN people g ON g.id = a.giver_id
         LEFT JOIN people r ON r.id = a.giftee_id
        WHERE a.draw_id = ? ORDER BY 2`,
    ).bind(draw.id),
    env.DB.prepare(
      `SELECT a.giver_id AS giverId, a.giftee_id AS gifteeId,
              a.giver_household AS giverHousehold, a.giftee_household AS gifteeHousehold, d.year
         FROM assignments a JOIN draws d ON d.id = a.draw_id
        WHERE d.year = (SELECT MAX(year) FROM draws WHERE year < ?)`,
    ).bind(year),
  ]);
  const lastPerson = new Set(previous.results.map((a) => `${a.giverId}>${a.gifteeId}`));
  const lastHousehold = new Set(previous.results.map((a) => `${a.giverHousehold}>${a.gifteeHousehold}`));

  return json({
    year,
    previousYear: previous.results[0]?.year ?? null,
    pairs: pairs.results.map((p) => ({
      giver: p.giver,
      giftee: p.giftee,
      samePersonAsLastYear: p.giverId != null && p.gifteeId != null && lastPerson.has(`${p.giverId}>${p.gifteeId}`),
      sameFamilyAsLastYear: lastHousehold.has(`${p.giverHousehold}>${p.gifteeHousehold}`),
    })),
  });
}

// Organizer only: delete a year's draw (e.g. one drawn by mistake). If it was
// the newest year, the year before becomes the one people see.
export async function onRequestDelete({ env, data, params }) {
  await requireAdmin(env, data);
  const year = parseYear(params.year);
  const { meta } = await env.DB.prepare('DELETE FROM draws WHERE year = ?').bind(year).run();
  if (!meta.changes) throw new HttpError(404, `There's no ${year} draw.`);
  return json({ ok: true });
}
