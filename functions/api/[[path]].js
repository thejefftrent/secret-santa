import { HttpError } from '../../lib/http.js';

export function onRequest() {
  throw new HttpError(404, 'No such API route.');
}
