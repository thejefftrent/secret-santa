import { json } from '../../lib/http.js';
import { allHouseholds } from '../../lib/lists.js';

// Signed-in family only: every household, person and wish.
export async function onRequestGet({ env, data }) {
  await data.requireUser();
  return json({ households: await allHouseholds(env.DB) });
}
