import { clientIp, forgiveAttempt, reserveAttempt, startSession, verifyPassword } from '../../lib/auth.js';
import { HttpError, json, readJson } from '../../lib/http.js';
import { personName } from '../../lib/validate.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const name = personName(body.name);
  const pw = typeof body.password === 'string' ? body.password : '';

  // Wrong guesses are limited per name on this device (so a stranger can't lock
  // someone out by typing their name wrong), per device across all names, and
  // per name across all devices as a backstop.
  const who = name.toLowerCase();
  const ip = clientIp(request);
  const deviceKey = `login:${who}:${ip}`;
  const attempt = await reserveAttempt(env.DB, [
    { key: deviceKey, limit: 10, minutes: 15 },
    { key: `login-ip:${ip}`, limit: 30, minutes: 15 },
    { key: `login:${who}`, limit: 50, minutes: 15 },
  ]);

  const account = await env.DB.prepare(
    'SELECT p.id, a.password_hash FROM people p JOIN accounts a ON a.person_id = p.id WHERE p.name = ?',
  )
    .bind(name)
    .first();
  if (!account || !(await verifyPassword(pw, account.password_hash))) {
    throw new HttpError(401, "That name and password don't match. Use the name you signed up with.");
  }

  await forgiveAttempt(env.DB, attempt, [deviceKey]);
  const cookie = await startSession(env.DB, request, account.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}
