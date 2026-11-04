import { api, el, wishList } from './common.js';

// Read-only view of one person's list: /shared?t=<token>
const list = document.getElementById('list');
const token = new URLSearchParams(location.search).get('t') || '';

try {
  if (!token) throw new Error("This link is missing part of its address. Ask whoever sent it to copy it again.");
  const { person } = await api(`/api/shared/${encodeURIComponent(token)}`);
  document.title = `${person.name}'s Christmas Wishlist`;
  document.getElementById('title').textContent = `${person.name}'s Wishlist`;
  list.replaceChildren(
    el('h2', { class: 'wish-card__title' }, `${person.name} is wishing for…`),
    wishList(person.items, `${person.name} hasn't added any wishes yet. Check back closer to Christmas!`),
  );
} catch (err) {
  const message =
    err.status === 404 ? "This link has been turned off or doesn't exist. Ask whoever sent it for a new one." : err.message;
  list.replaceChildren(el('p', { class: 'mb-0' }, message));
}
