import { endSession } from '../../lib/auth.js';
import { json } from '../../lib/http.js';

export async function onRequestPost({ request, env }) {
  const cookie = await endSession(env.DB, request);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}
