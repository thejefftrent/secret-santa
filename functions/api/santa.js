import { currentDraw } from '../../lib/admin.js';
import { json } from '../../lib/http.js';

// Signed in: who you're gifting in this year's draw, with their wishlist.
// Adults also see everyone else in their household (partner and kids), so they
// can help each other shop. Kids see only their own person. Someone else's row
// is never shown if its giftee is in your household (that can only happen if the
// organizer moved people after the draw), so nobody learns who's gifting them.
export async function onRequestGet({ env, data }) {
  const user = await data.requireUser();
  const draw = await currentDraw(env.DB);
  if (!draw) return json({ year: null, people: [] });

  const { results: rows } = await env.DB.prepare(
    `SELECT g.id, g.name, r.id AS gifteeId, COALESCE(r.name, a.giftee_name) AS gifteeName
       FROM assignments a
       JOIN people g ON g.id = a.giver_id
       LEFT JOIN people r ON r.id = a.giftee_id
      WHERE a.draw_id = ?1
        AND (g.id = ?2 OR (?3 = 0 AND g.household = ?4 AND COALESCE(r.household, '') <> ?4))
      ORDER BY g.id = ?2 DESC, g.id`,
  )
    .bind(draw.id, user.id, user.isKid ? 1 : 0, user.household)
    .all();

  const { results: items } = await env.DB.prepare(
    `SELECT id, person_id AS personId, text, link FROM items
      WHERE person_id IN (SELECT value FROM json_each(?)) ORDER BY id`,
  )
    .bind(JSON.stringify(rows.map((r) => r.gifteeId)))
    .all();

  return json({
    year: draw.year,
    people: rows.map((r) => ({
      name: r.name,
      isMe: r.id === user.id,
      giftee: {
        name: r.gifteeName,
        items: items.filter((i) => i.personId === r.gifteeId).map(({ id, text, link }) => ({ id, text, link })),
      },
    })),
  });
}
