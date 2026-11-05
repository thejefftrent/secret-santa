// Helpers shared by every page.

// A page restored from the back/forward cache still shows whoever was signed in
// when it was left, which may not be who is now (sign out, or an organizer
// switching to someone else and back). Reload it so it asks the server again.
addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

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

/**
 * Page extras that depend on who's signed in. Pages call this with the user from
 * /api/me (or null) every time they load it: organizers get the Admin link, and
 * an organizer signed in as someone else gets a banner to switch back.
 */
export function showSignedInChrome(user) {
  if (user?.isAdmin) showAdminLink();
  document.querySelector('.impersonation-bar')?.remove();
  if (user?.impersonatedBy) document.body.prepend(impersonationBanner(user));
}

function showAdminLink() {
  const nav = document.querySelector('.site-nav');
  if (!nav || nav.querySelector('a[href="/admin"]')) return;
  nav.append(el('a', { href: '/admin' }, 'Admin'));
}

function impersonationBanner(user) {
  const organizer = user.impersonatedBy.name;
  const back = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-sm btn-dark',
      onclick: async () => {
        back.disabled = true;
        try {
          await api('/api/impersonation', { method: 'DELETE' });
        } catch (err) {
          back.disabled = false;
          // 400: already switched back (e.g. in another tab), so the Admin page works as is.
          if (err.status !== 400) {
            await alertDialog(
              err.status === 401
                ? `Your sign-in as ${user.name} has ended. It lasts up to an hour, and ends early if they're removed or a password changes. Sign in as ${organizer} again.`
                : err.message,
            );
            if (err.status !== 401) return;
          }
        }
        location.replace('/admin');
      },
    },
    `Back to ${organizer}`,
  );
  return el(
    'div',
    { class: 'impersonation-bar', role: 'status' },
    el('span', {}, 'You’re signed in as ', el('b', {}, user.name), '. Everything you do here is done as them.'),
    back,
  );
}

/** "Jeff, Erinn, Ben & Milo" */
export function joinNames(people) {
  const names = people.map((p) => p.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0] ?? '';
}
