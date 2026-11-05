import { api, el, showSignedInChrome, wishList } from './common.js';

// Home page: sign in with your name and password, then reveal who you're gifting.
const $ = (id) => document.getElementById(id);

let santa = null; // GET /api/santa: { year, people: [{ name, isMe, giftee: { name, items } }] }

function showResult(...content) {
  $('giveTo').replaceChildren(...content);
  if (content.length) $('resultBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function reveal(person) {
  const heading = [
    person.isMe ? 'You are giving a gift to' : `${person.name} is giving a gift to`,
    el('br'),
    el('b', { class: 'giftee-name' }, person.giftee.name),
  ];
  const { name, items } = person.giftee;
  if (!items.length) {
    showResult(...heading, el('p', { class: 'giftee-note' }, `${name} hasn't added any wishes yet. Check back closer to Christmas!`));
  } else {
    showResult(...heading, el('p', { class: 'giftee-note' }, 'They’re wishing for:'), wishList(items));
  }
}

function showView(view) {
  $('loading').hidden = view !== 'loading';
  $('signinForm').hidden = view !== 'signedOut';
  $('signedInView').hidden = view !== 'signedIn';
}

function renderSignedIn(user) {
  const mine = santa.people.find((p) => p.isMe);
  $('hello').textContent = `Hi ${user.name}! 🎄`;
  $('drawStatus').textContent = !santa.year
    ? "Santa hasn't drawn names yet. Check back soon!"
    : mine
      ? `Ready to find out who you're gifting in ${santa.year}?`
      : `You're not in the ${santa.year} Secret Santa draw.`;
  $('revealMine').hidden = !mine;

  const others = santa.people.filter((p) => !p.isMe);
  $('householdReveal').hidden = !others.length;
  $('householdButtons').replaceChildren(
    ...others.map((person) =>
      el(
        'button',
        { type: 'button', class: 'btn btn-outline-success', onclick: () => reveal(person) },
        `See who ${person.name} is gifting`,
      ),
    ),
  );
  showView('signedIn');
}

/** Loads the signed-in state; returns this user's own draw entry (or null). */
async function load() {
  const me = await api('/api/me');
  showSignedInChrome(me.user);
  if (!me.user) {
    santa = null;
    showView('signedOut');
    return null;
  }
  santa = await api('/api/santa');
  renderSignedIn(me.user);
  return santa.people.find((p) => p.isMe) ?? null;
}

$('signinForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  const name = $('name').value.trim();
  if (!name) return showResult('Please tell me your name first!');
  if (!$('password').value) return showResult('And your password, please!');

  button.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: { name, password: $('password').value } });
    $('password').value = '';
    const mine = await load();
    // They asked for their person, so show it straight away.
    if (mine) reveal(mine);
    else showResult($('drawStatus').textContent);
  } catch (err) {
    showResult(err.message);
  } finally {
    button.disabled = false;
  }
});

$('revealMine').addEventListener('click', async () => {
  try {
    const mine = await load();
    if (mine) reveal(mine);
  } catch (err) {
    if (err.status === 401) return start();
    showResult(err.message);
  }
});

$('signOut').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } finally {
    showResult();
    await start();
  }
});

async function start() {
  try {
    await load();
  } catch (err) {
    if (err.status === 401) {
      showView('signedOut');
      return;
    }
    $('loading').textContent = err.message;
    showView('loading');
  }
}

start();
