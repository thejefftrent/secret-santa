import { requireAdmin, requireHousehold } from '../../../../../lib/admin.js';
import { newFamilyCode } from '../../../../../lib/codes.js';
import { json } from '../../../../../lib/http.js';

// Organizer only: give a family group a new sign-up code (e.g. if the old one got
// shared too widely). The old code stops working; existing accounts are unaffected.
export async function onRequestPost({ env, data, params }) {
  await requireAdmin(env, data);
  const household = await requireHousehold(env.DB, String(params.id));
  const { results } = await env.DB.prepare('SELECT code FROM household_codes').all();
  const used = new Set(results.map((r) => r.code));
  let code;
  do code = newFamilyCode();
  while (used.has(code));
  await env.DB.prepare(
    `INSERT INTO household_codes (household, code) VALUES (?, ?)
     ON CONFLICT (household) DO UPDATE SET code = excluded.code, created_at = datetime('now')`,
  )
    .bind(household, code)
    .run();
  return json({ code });
}
