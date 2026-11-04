import { alertDialog, api, confirmDialog, el, showAdminLink, wishContent } from './common.js';

const $ = (id) => document.getElementById(id);

let user = null; // { id, name, household, isKid, isAdmin }
let people = []; // everyone this user manages (adults: their household; kids: themselves), with items and shareToken
let editingItemId = null;

// ---------- page state ----------

async function load() {
  try {
    const me = await api('/api/me');
    if (me.user) {
      user = me.user;
      people = me.household.people;
      showSignedIn();
    } else {
      user = null;
      await showSignedOut();
    }
    $('status').hidden = true;
  } catch (err) {
    $('status').hidden = false;
    $('status').textContent = err.message;
  }
}

/** Where to go after signing in: a same-site path from ?next=, or null to stay here. */
function nextPage() {
  const next = new URLSearchParams(location.search).get('next');
  if (!next) return null;
  try {
    const url = new URL(next, location.origin);
    // Same site only, and never a path like "//evil.example" that a browser reads as another site.
    if (url.origin !== location.origin || url.pathname.startsWith('//') || url.pathname === '/account') return null;
    return url.href;
  } catch {
    return null;
  }
}

async function afterSignIn() {
  const next = nextPage();
  if (next) location.assign(next);
  else await load();
}

/** Runs an action that needs a session; drops back to the sign-in form if it expired. */
async function withSession(action, onError) {
  try {
    await action();
  } catch (err) {
    if (err.status === 401) return signedOutAgain();
    onError(err.message);
  }
}

/** The session ended (expired, password changed elsewhere, or reset): back to sign-in, with a reason. */
async function signedOutAgain() {
  await load();
  if (!user) {
    const error = $('signinForm').querySelector('.form-error');
    error.textContent = 'You were signed out. Sign in again to keep going.';
  }
}

// ---------- signed out ----------

async function showSignedOut() {
  selectTab(new URLSearchParams(location.search).get('tab') === 'signup' ? 'signup' : 'signin');
  $('greeting').textContent = "Sign in to tell Santa what you'd like this year.";
  $('signedIn').hidden = true;
  $('signedOut').hidden = false;
}

function selectTab(which) {
  for (const [tab, form] of [
    ['tabSignin', 'signinForm'],
    ['tabSignup', 'signupForm'],
  ]) {
    const active = form === `${which}Form`;
    $(tab).setAttribute('aria-selected', String(active));
    $(form).hidden = !active;
  }
}

$('tabSignin').addEventListener('click', () => selectTab('signin'));
$('tabSignup').addEventListener('click', () => selectTab('signup'));

/** Wires a form: disables its button while busy and shows errors in its .form-error. */
function handleForm(form, submit) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type=submit]');
    const error = form.querySelector('.form-error');
    error.textContent = '';
    button.disabled = true;
    try {
      await submit(form);
    } catch (err) {
      if (err.status === 401 && user) return signedOutAgain();
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}

handleForm($('signinForm'), async () => {
  const name = $('signinName').value.trim();
  if (!name) throw new Error('Type your name first.');
  await api('/api/login', { method: 'POST', body: { name, password: $('signinPassword').value } });
  $('signinPassword').value = '';
  await afterSignIn();
});

handleForm($('signupForm'), async () => {
  const name = $('signupName').value.trim();
  if (!name) throw new Error('Type your name first.');
  await api('/api/signup', {
    method: 'POST',
    body: { name, password: $('signupPassword').value, familyCode: $('familyCode').value },
  });
  $('signupPassword').value = '';
  $('familyCode').value = '';
  await afterSignIn();
});

// ---------- signed in ----------

function showSignedIn() {
  $('hello').textContent = `Hi ${user.name}! 🎄`;
  $('greeting').textContent =
    people.length > 1
      ? "Add what you'd like for Christmas, and keep your household's lists up to date."
      : "Add what you'd like for Christmas.";
  $('addMemberCol').hidden = user.isKid; // kids can't change their household
  $('signedOut').hidden = true;
  $('signedIn').hidden = false;
  render();
  if (user.isAdmin) showAdminLink();
}

function showListError(message) {
  $('listError').textContent = message;
  $('listError').hidden = !message;
  if (message) $('listError').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function render(focusPersonId) {
  const ordered = [...people].sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  $('lists').replaceChildren(...ordered.map(personCard));
  if (focusPersonId) $(`add-${focusPersonId}`)?.focus();
}

function personCard(person) {
  const isMe = person.id === user.id;
  const canRemove = !user.isKid && !isMe && !person.hasAccount && !person.inDraw;
  return el(
    'div',
    { class: 'col-12 col-lg-6' },
    el(
      'section',
      { class: 'wish-card h-100' },
      el(
        'div',
        { class: 'd-flex align-items-start justify-content-between gap-2' },
        el('h2', { class: 'wish-card__title' }, isMe ? 'My wishes' : `${person.name}'s wishes`),
        canRemove &&
          el(
            'button',
            { type: 'button', class: 'btn btn-link btn-sm link-danger p-0', onclick: () => removePerson(person) },
            `Remove ${person.name}`,
          ),
      ),
      person.items.length
        ? el('ul', { class: 'wish-list wish-list--edit' }, person.items.map((item) => itemRow(person, item)))
        : el('p', { class: 'wish-empty' }, 'No wishes yet. Add the first one below!'),
      addItemForm(person),
      shareBox(person),
    ),
  );
}

function itemRow(person, item) {
  if (item.id === editingItemId) return editItemRow(person, item);
  return el(
    'li',
    {},
    el('span', { class: 'wish-text' }, wishContent(item)),
    el(
      'span',
      { class: 'wish-actions' },
      el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: () => startEdit(item) }, 'Edit'),
      el(
        'button',
        { type: 'button', class: 'btn btn-sm btn-outline-danger', onclick: () => removeItem(person, item) },
        'Remove',
      ),
    ),
  );
}

function editItemRow(person, item) {
  const text = el('input', { class: 'form-control mb-2', value: item.text, maxlength: 200, 'aria-label': 'Wish' });
  const link = el('input', {
    class: 'form-control mb-2',
    value: item.link ?? '',
    type: 'url',
    placeholder: 'Link (optional)',
    'aria-label': 'Link',
  });
  const error = el('p', { class: 'form-error', role: 'alert' });
  const form = el(
    'form',
    {
      class: 'wish-edit',
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        withSession(
          async () => {
            const { item: saved } = await api(`/api/items/${item.id}`, {
              method: 'PUT',
              body: { text: text.value, link: link.value },
            });
            Object.assign(item, saved);
            editingItemId = null;
            render();
          },
          (message) => (error.textContent = message),
        );
      },
    },
    text,
    link,
    error,
    el(
      'div',
      { class: 'd-flex gap-2' },
      el('button', { type: 'submit', class: 'btn btn-sm btn-success cta-btn' }, 'Save'),
      el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: cancelEdit }, 'Cancel'),
    ),
  );
  queueMicrotask(() => text.focus());
  return el('li', {}, form);
}

function startEdit(item) {
  editingItemId = item.id;
  showListError('');
  render();
}

function cancelEdit() {
  editingItemId = null;
  render();
}

function addItemForm(person) {
  const text = el('input', {
    class: 'form-control',
    id: `add-${person.id}`,
    placeholder: person.id === user.id ? 'What would you like?' : `What would ${person.name} like?`,
    maxlength: 200,
    'aria-label': `New wish for ${person.name}`,
  });
  const link = el('input', {
    class: 'form-control',
    type: 'url',
    placeholder: 'Link (optional)',
    'aria-label': `Link for ${person.name}'s new wish`,
  });
  const error = el('p', { class: 'form-error mb-0', role: 'alert' });
  return el(
    'form',
    {
      class: 'wish-add',
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        if (!text.value.trim()) {
          error.textContent = 'Type a wish first.';
          return;
        }
        withSession(
          async () => {
            const { item } = await api('/api/items', {
              method: 'POST',
              body: { personId: person.id, text: text.value, link: link.value },
            });
            person.items.push(item);
            render(person.id);
          },
          (message) => (error.textContent = message),
        );
      },
    },
    el('div', { class: 'wish-add__fields' }, text, link),
    el('button', { type: 'submit', class: 'btn btn-success cta-btn' }, 'Add wish'),
    error,
  );
}

// ---------- share links ----------

const shareUrl = (token) => `${location.origin}/shared?t=${encodeURIComponent(token)}`;

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => (button.textContent = label), 2000);
    return true;
  } catch {
    return false;
  }
}

function shareBox(person) {
  const whose = person.id === user.id ? 'your' : `${person.name}'s`;
  const error = el('p', { class: 'form-error mb-0 mt-2', role: 'alert' });
  const fail = (message) => (error.textContent = message);

  const turnOn = () =>
    withSession(async () => {
      const { shareToken } = await api('/api/share', { method: 'POST', body: { personId: person.id } });
      person.shareToken = shareToken;
      render();
    }, fail);

  if (!person.shareToken) {
    return el(
      'div',
      { class: 'share-box' },
      el(
        'button',
        { type: 'button', class: 'btn btn-sm btn-outline-success', onclick: turnOn },
        `Get a link to share ${whose} list`,
      ),
      el('p', { class: 'hint mb-0 mt-1' }, 'For people without an account, like grandparents or friends.'),
      error,
    );
  }

  const url = shareUrl(person.shareToken);
  const input = el('input', {
    class: 'form-control form-control-sm',
    value: url,
    readonly: true,
    'aria-label': `Share link for ${whose} list`,
    onfocus: (event) => event.target.select(),
  });
  const copy = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-success cta-btn',
    onclick: async (event) => {
      if (!(await copyText(url, event.currentTarget))) input.select();
    },
  }, 'Copy');
  return el(
    'div',
    { class: 'share-box' },
    el('label', { class: 'form-label small mb-1' }, 'Share link'),
    el('div', { class: 'input-group' }, input, copy),
    el(
      'p',
      { class: 'hint mb-0 mt-1' },
      `Anyone with this link can see ${whose} list, but can't change it. `,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-link btn-sm p-0 align-baseline',
          onclick: async () => {
            if (await confirmDialog(`Make a new link? The old link for ${whose} list will stop working.`, { confirmLabel: 'Make a new link' })) turnOn();
          },
        },
        'New link',
      ),
      ' · ',
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-link btn-sm p-0 align-baseline link-danger',
          onclick: async () => {
            if (!(await confirmDialog(`Turn off sharing? The link for ${whose} list will stop working.`, { confirmLabel: 'Turn off', danger: true }))) return;
            withSession(async () => {
              await api(`/api/share/${person.id}`, { method: 'DELETE' });
              person.shareToken = null;
              render();
            }, fail);
          },
        },
        'Turn off',
      ),
    ),
    error,
  );
}

// ---------- list and household changes ----------

async function removeItem(person, item) {
  const whose = person.id === user.id ? 'your' : `${person.name}'s`;
  if (!(await confirmDialog(`Remove "${item.text}" from ${whose} list?`, { confirmLabel: 'Remove', danger: true }))) return;
  withSession(async () => {
    await api(`/api/items/${item.id}`, { method: 'DELETE' });
    person.items = person.items.filter((i) => i.id !== item.id);
    showListError('');
    render();
  }, showListError);
}

async function removePerson(person) {
  const wishes = person.items.length ? ` and their ${person.items.length} wish(es)` : '';
  if (!(await confirmDialog(`Remove ${person.name}${wishes} from your household?`, { confirmLabel: 'Remove', danger: true }))) return;
  withSession(async () => {
    await api(`/api/household/${person.id}`, { method: 'DELETE' });
    people = people.filter((p) => p.id !== person.id);
    showListError('');
    render();
  }, showListError);
}

handleForm($('addMemberForm'), async () => {
  const { person } = await api('/api/household', {
    method: 'POST',
    body: { name: $('memberName').value, isKid: $('memberRole').value === 'kid' },
  });
  $('memberName').value = '';
  people.push(person);
  render(person.id);
});

handleForm($('passwordForm'), async (form) => {
  await api('/api/password', {
    method: 'POST',
    body: { currentPassword: $('currentPassword').value, newPassword: $('newPassword').value },
  });
  form.reset();
  form.closest('details').open = false;
  await alertDialog('Password changed. Any other devices you were signed in on have been signed out.');
});

$('signOut').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } finally {
    user = null;
    people = [];
    await load();
  }
});

load();
