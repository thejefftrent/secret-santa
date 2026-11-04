import { currentUser } from '../../lib/auth.js';
import { HttpError, json } from '../../lib/http.js';

// Runs before every /api route: blocks cross-site writes, exposes the signed-in
// user to handlers, and turns thrown HttpErrors into JSON responses.
export async function onRequest(context) {
  const { request, env, data } = context;
  try {
    if (!env.DB) throw new HttpError(500, 'The database binding (DB) is not configured.');

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      // A cross-site page can't send a JSON POST without a CORS preflight, which we never approve.
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) {
        throw new HttpError(415, 'Requests must be JSON.');
      }
      const origin = request.headers.get('Origin');
      if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-site request blocked.');
    }

    let user;
    data.user = () => (user ??= currentUser(env.DB, request));
    data.requireUser = async () => {
      const signedIn = await data.user();
      if (!signedIn) throw new HttpError(401, 'Please sign in first.');
      return signedIn;
    };

    return await context.next();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
    console.error(err);
    return json({ error: 'Something went wrong on our end. Please try again.' }, { status: 500 });
  }
}
