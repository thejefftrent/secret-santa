import { isAdmin } from '../../lib/admin.js';
import { json } from '../../lib/http.js';
import { managedLists } from '../../lib/lists.js';

export async function onRequestGet({ env, data }) {
  const user = await data.user();
  if (!user) return json({ user: null });
  return json({
    user: { ...user, isAdmin: isAdmin(env, user) },
    // Adults get everyone in their household; kids get only themselves.
    household: await managedLists(env.DB, user),
  });
}
