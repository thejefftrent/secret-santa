import { endAllSessions, forgiveAttempt, hashPassword, reserveAttempt, startSession, verifyPassword } from '../../lib/auth.js';
import { HttpError, json, readJson } from '../../lib/http.js';
import { password } from '../../lib/validate.js';

// Change your own password. Signs out every other device.
export async function onRequestPost({ request, env, data }) {
  const user = await data.requireUser();
  const body = await readJson(request);
  const next = password(body.newPassword);

  const attempt = await reserveAttempt(env.DB, [{ key: `password:${user.id}`, limit: 10, minutes: 15 }]);
  const account = await env.DB.prepare('SELECT password_hash FROM accounts WHERE person_id = ?').bind(user.id).first();
  if (!account || !(await verifyPassword(String(body.currentPassword ?? ''), account.password_hash))) {
    throw new HttpError(403, "Your current password isn't right.");
  }
  await forgiveAttempt(env.DB, attempt);

  await env.DB.prepare('UPDATE accounts SET password_hash = ? WHERE person_id = ?')
    .bind(await hashPassword(next), user.id)
    .run();
  await endAllSessions(env.DB, user.id);
  const cookie = await startSession(env.DB, request, user.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}
