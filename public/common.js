// Helpers shared by every page.

/** Calls the API and returns its JSON; throws an Error carrying the server's message. */
export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Couldn't reach the North Pole. Check your connection and try again.");
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON error page
  }
  if (!res.ok) {
    const err = new Error(data.error || `Something went wrong (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Tiny DOM builder: el('a', { href, class: 'x', onclick: fn }, 'text', child). Never parses HTML. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

/** A wish's text, as a link that opens in a new tab when it has one. */
export function wishContent(item) {
  if (item.link && /^https?:\/\//i.test(item.link)) {
    return el('a', { href: item.link, target: '_blank', rel: 'noopener noreferrer nofollow' }, item.text);
  }
  return document.createTextNode(item.text);
}

export function wishList(items, emptyText = 'No wishes yet.') {
  if (!items.length) return el('p', { class: 'wish-empty' }, emptyText);
  return el('ul', { class: 'wish-list' }, items.map((item) => el('li', {}, wishContent(item))));
}

/**
 * In-page yes/no dialog. Resolves true if confirmed. Used instead of the browser's
 * confirm(), which some browsers (and embedded previews) block or auto-dismiss.
 */
export function confirmDialog(message, { confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const dialog = el(
      'dialog',
      { class: 'santa-dialog' },
      el(
        'form',
        { method: 'dialog' },
        el('p', { class: 'santa-dialog__message' }, message),
        el(
          'div',
          { class: 'santa-dialog__actions' },
          cancelLabel && el('button', { value: 'cancel', class: 'btn btn-outline-secondary' }, cancelLabel),
          el('button', { value: 'ok', class: danger ? 'btn btn-danger' : 'btn btn-success cta-btn', autofocus: true }, confirmLabel),
        ),
      ),
    );
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** In-page message with a single OK button (instead of the browser's alert()). */
export function alertDialog(message) {
  return confirmDialog(message, { cancelLabel: null });
}

/** Adds the Admin link to the nav for organizers (pages call this once they know who's signed in). */
export function showAdminLink() {
  const nav = document.querySelector('.site-nav');
  if (!nav || nav.querySelector('a[href="/admin"]')) return;
  nav.append(el('a', { href: '/admin' }, 'Admin'));
}

/** "Jeff, Erinn, Ben & Milo" */
export function joinNames(people) {
  const names = people.map((p) => p.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0] ?? '';
}
