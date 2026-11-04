import { HttpError } from './http.js';

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function cleanText(value, field, { min = 1, max }) {
  if (typeof value !== 'string') throw new HttpError(400, `${field} is missing.`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (CONTROL_CHARS.test(text)) throw new HttpError(400, `${field} has characters we can't use.`);
  if (text.length < min) throw new HttpError(400, `${field} is missing.`);
  if (text.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer.`);
  return text;
}

export function personName(value) {
  return cleanText(value, 'Name', { max: 40 });
}

export function itemText(value) {
  return cleanText(value, 'Wish', { max: 200 });
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new HttpError(400, 'Passwords need at least 8 characters.');
  }
  if (value.length > 200) throw new HttpError(400, 'That password is too long.');
  return value;
}

/** Optional link: blank -> null, "amazon.com/x" -> "https://amazon.com/x", only http(s). */
export function itemLink(value) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Link must be text.');
  let link = value.trim();
  if (!link) return null;
  if (link.length > 2000) throw new HttpError(400, 'That link is too long.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(link)) link = `https://${link}`;
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, "That link doesn't look like a web address.");
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HttpError(400, 'Links must start with http:// or https://.');
  }
  if (!url.hostname.includes('.')) throw new HttpError(400, "That link doesn't look like a web address.");
  return url.href;
}

export function id(value, field = 'id') {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `Bad ${field}.`);
  return n;
}
