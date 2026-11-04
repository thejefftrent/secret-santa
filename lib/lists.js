import { HttpError } from './http.js';

// Deliberately no account info: the Wishlists page shouldn't list who hasn't signed up yet.
const PEOPLE_SQL = 'SELECT p.id, p.name, p.household FROM people p';
const ITEMS_SQL = `
  SELECT i.id, i.person_id AS personId, i.text, i.link
    FROM items i JOIN people p ON p.id = i.person_id`;

/** Groups rows into [{ id, people: [{ id, name, hasAccount, items: [...] }] }], in signup order. */
function groupHouseholds(people, items) {
  const byPerson = new Map();
  const households = new Map();
  for (const p of people) {
    const person = { id: p.id, name: p.name, items: [] };
    if ('hasAccount' in p) person.hasAccount = Boolean(p.hasAccount);
    if ('isKid' in p) person.isKid = Boolean(p.isKid);
    if ('inDraw' in p) person.inDraw = Boolean(p.inDraw);
    if ('shareToken' in p) person.shareToken = p.shareToken;
    byPerson.set(p.id, person);
    if (!households.has(p.household)) households.set(p.household, { id: p.household, people: [] });
    households.get(p.household).people.push(person);
  }
  for (const item of items) {
    byPerson.get(item.personId)?.items.push({ id: item.id, text: item.text, link: item.link });
  }
  return [...households.values()];
}

/** Every household's lists, for signed-in family. Never includes share links. */
export async function allHouseholds(db) {
  const [people, items] = await db.batch([
    db.prepare(`${PEOPLE_SQL} ORDER BY p.id`),
    db.prepare(`${ITEMS_SQL} ORDER BY i.id`),
  ]);
  return groupHouseholds(people.results, items.results);
}

/**
 * Who the signed-in user looks after: adults manage everyone in their household
 * (partner and kids); kids manage only themselves.
 */
export function canManage(user, person) {
  return person.id === user.id || (!user.isKid && person.household === user.household);
}

// SQL filter matching canManage(), for people aliased as p. Binds: household, isKid, user id.
const MANAGED_SQL = 'p.household = ? AND (? = 0 OR p.id = ?)';
const managedBinds = (user) => [user.household, user.isKid ? 1 : 0, user.id];

/** The lists the user manages, with each person's share-link token (or null) and kid flag. */
export async function managedLists(db, user) {
  const [people, items] = await db.batch([
    db
      .prepare(
        `SELECT p.id, p.name, p.household, p.is_kid AS isKid, (a.person_id IS NOT NULL) AS hasAccount,
                s.token AS shareToken,
                EXISTS (SELECT 1 FROM assignments x
                         WHERE x.draw_id = (SELECT id FROM draws ORDER BY year DESC LIMIT 1)
                           AND (x.giver_id = p.id OR x.giftee_id = p.id)) AS inDraw
           FROM people p
           LEFT JOIN accounts a ON a.person_id = p.id
           LEFT JOIN share_links s ON s.person_id = p.id
          WHERE ${MANAGED_SQL} ORDER BY p.id`,
      )
      .bind(...managedBinds(user)),
    db.prepare(`${ITEMS_SQL} WHERE ${MANAGED_SQL} ORDER BY i.id`).bind(...managedBinds(user)),
  ]);
  return groupHouseholds(people.results, items.results)[0] ?? { id: user.household, people: [] };
}

/** One person's wishes, oldest first. */
export async function itemsFor(db, personId) {
  const { results } = await db
    .prepare('SELECT id, text, link FROM items WHERE person_id = ? ORDER BY id')
    .bind(personId)
    .all();
  return results;
}

/** Throws unless the signed-in user manages this person (see canManage). */
export async function requireManaged(db, user, personId) {
  const person = await db.prepare('SELECT id, name, household FROM people WHERE id = ?').bind(personId).first();
  if (!person || !canManage(user, person)) {
    throw new HttpError(
      403,
      user.isKid ? 'You can only change your own list.' : 'You can only change lists for people in your household.',
    );
  }
  return person;
}

/** Throws unless the signed-in user is an adult (kids can't change their household). */
export function requireAdult(user) {
  if (user.isKid) throw new HttpError(403, 'Ask a grown-up in your household to do that.');
}

export function isUniqueViolation(err) {
  return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(String(err?.message ?? err));
}
