import { currentDraw, familyCodes, isAdminName, requireAdmin } from '../../../lib/admin.js';
import { json } from '../../../lib/http.js';

// Organizer only: every family group (household) with its sign-up code, and every
// person, with whether they have an account and whether they're in this year's draw.
export async function onRequestGet({ env, data }) {
  const user = await requireAdmin(env, data);
  const draw = await currentDraw(env.DB);
  const [people, participants] = await env.DB.batch([
    env.DB.prepare(
      `SELECT p.id, p.name, p.household, p.is_kid AS isKid, (a.person_id IS NOT NULL) AS hasAccount
         FROM people p LEFT JOIN accounts a ON a.person_id = p.id ORDER BY p.id`,
    ),
    env.DB.prepare('SELECT giver_id AS id FROM assignments WHERE draw_id = ? AND giver_id IS NOT NULL').bind(draw?.id ?? -1),
  ]);
  const inDraw = new Set(participants.results.map((r) => r.id));
  const codes = await familyCodes(env.DB);

  const households = new Map();
  for (const p of people.results) {
    if (!households.has(p.household)) households.set(p.household, { id: p.household, code: codes.get(p.household), people: [] });
    households.get(p.household).people.push({
      id: p.id,
      name: p.name,
      isKid: Boolean(p.isKid),
      hasAccount: Boolean(p.hasAccount),
      inDraw: inDraw.has(p.id),
      isAdmin: isAdminName(env, p.name),
      isMe: p.id === user.id,
    });
  }
  return json({
    households: [...households.values()],
    currentDraw: draw && { year: draw.year, participantIds: [...inDraw] },
  });
}
