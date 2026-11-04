import { alertDialog, api, confirmDialog, el, joinNames } from './common.js';

// Organizer page: family groups, running the draw, and who has whom.
const $ = (id) => document.getElementById(id);

let family = null; // GET /api/admin/family: { households: [{ id, people }], currentDraw }
let draws = []; // GET /api/admin/draws: [{ year, people, createdAt }]
let editingId = null; // person whose row is in edit mode

async function start() {
  try {
    const me = await api('/api/me');
    if (!me.user) return gate('Sign in as the organizer to use this page.', true);
    if (!me.user.isAdmin) return gate('Only the Secret Santa organizer can use this page.', false);
    await refresh();
    $('status').hidden = true;
    $('gate').hidden = true;
    $('adminContent').hidden = false;
  } catch (err) {
    $('status').hidden = false;
    $('status').textContent = err.message;
  }
}

function gate(message, showSignIn) {
  // Signed out or not an organizer (maybe someone else signed in on this computer): hide everything.
  hidePairs();
  family = null;
  draws = [];
  $('adminContent').hidden = true;
  $('status').hidden = true;
  $('gateMessage').textContent = message;
  $('gateSignIn').hidden = !showSignIn;
  $('gate').hidden = false;
}

async function refresh({ showYear } = {}) {
  const [familyData, drawData] = await Promise.all([api('/api/admin/family'), api('/api/admin/draws')]);
  family = familyData;
  draws = drawData.draws;
  renderFamily();
  renderDrawPanel();
  renderPairsControls(showYear);
}

/** Runs an admin action; a 401/403 (signed out, or no longer admin) restarts the page. */
async function act(action, onError) {
  try {
    await action();
  } catch (err) {
    if (err.status === 401 || (err.status === 403 && /organizer/.test(err.message))) return start();
    onError(err.message);
  }
}

function showMessage(id, kind, text) {
  const box = $(id);
  box.className = `alert alert-${kind}`;
  box.textContent = text;
  box.hidden = !text;
}

// ---------- family groups ----------

const groupLabel = (household) => joinNames(household.people);

function householdOptions(selected, { allowNew = true } = {}) {
  return [
    ...family.households.map((h) => el('option', { value: h.id, selected: h.id === selected }, groupLabel(h))),
    allowNew && el('option', { value: '', selected: selected === '' }, '+ New family group'),
  ];
}

function renderFamily() {
  $('families').replaceChildren(
    ...family.households.map((household) =>
      el(
        'div',
        { class: 'col-12 col-lg-6' },
        el(
          'section',
          { class: 'admin-group h-100' },
          el('h3', { class: 'admin-group__title' }, groupLabel(household)),
          familyCodeRow(household),
          el('ul', { class: 'admin-people' }, household.people.map((person) => personRow(household, person))),
        ),
      ),
    ),
  );
  const keep = $('newHousehold').value;
  const stillThere = $('newHousehold').options.length && (keep === '' || family.households.some((h) => h.id === keep));
  $('newHousehold').replaceChildren(...householdOptions(stillThere ? keep : family.households[0]?.id ?? ''));
}

function familyCodeRow(household) {
  const copy = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-outline-secondary',
    onclick: async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(household.code);
        button.textContent = 'Copied!';
        setTimeout(() => (button.textContent = 'Copy'), 2000);
      } catch {
        alertDialog(`Sign-up code for ${groupLabel(household)}: ${household.code}`);
      }
    },
  }, 'Copy');
  const renew = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-link p-0 ms-1',
    onclick: async () => {
      const ok = await confirmDialog(
        `Make a new sign-up code for ${groupLabel(household)}? The old code stops working. Existing accounts aren't affected.`,
        { confirmLabel: 'Make a new code' },
      );
      if (!ok) return;
      act(async () => {
        const { code } = await api(`/api/admin/households/${encodeURIComponent(household.id)}/code`, { method: 'POST' });
        household.code = code;
        renderFamily();
        showMessage('familyMessage', 'success', `New sign-up code for ${groupLabel(household)}: ${code}`);
      }, (message) => showMessage('familyMessage', 'danger', message));
    },
  }, 'New code');
  return el(
    'div',
    { class: 'family-code' },
    el('span', { class: 'family-code__label' }, 'Sign-up code'),
    el('code', { class: 'family-code__value' }, household.code ?? '…'),
    copy,
    renew,
  );
}

function badge(text, kind) {
  return el('span', { class: `badge rounded-pill admin-badge admin-badge--${kind}` }, text);
}

function personRow(household, person) {
  if (person.id === editingId) return editRow(household, person);
  const year = family.currentDraw?.year;
  return el(
    'li',
    { class: 'admin-person' },
    el(
      'div',
      { class: 'admin-person__main' },
      el('span', { class: 'admin-person__name' }, person.name),
      badge(person.isKid ? 'Kid' : 'Adult', person.isKid ? 'kid' : 'adult'),
      person.hasAccount ? badge('Account', 'account') : badge('No account', 'muted'),
      person.inDraw && badge(`In ${year} draw`, 'draw'),
      person.isAdmin && badge('Organizer', 'organizer'),
    ),
    el(
      'div',
      { class: 'admin-person__actions' },
      el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: () => startEdit(person) }, 'Edit'),
      person.hasAccount &&
        !person.isMe &&
        el(
          'button',
          { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: () => resetSignIn(person) },
          'Reset sign-in',
        ),
      !person.isMe &&
        !person.isAdmin &&
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-sm btn-outline-danger',
            disabled: person.inDraw,
            title: person.inDraw ? `In the ${year} draw: draw ${year} again without them first` : null,
            onclick: () => removePerson(person),
          },
          'Remove',
        ),
    ),
  );
}

function editRow(household, person) {
  const name = el('input', { class: 'form-control form-control-sm', value: person.name, maxlength: 40, 'aria-label': 'Name' });
  const group = el('select', { class: 'form-select form-select-sm', 'aria-label': 'Family group' }, householdOptions(household.id));
  const kid = el('input', { class: 'form-check-input', type: 'checkbox', checked: person.isKid });
  const error = el('p', { class: 'form-error mb-0', role: 'alert' });
  const form = el(
    'form',
    {
      class: 'admin-edit',
      novalidate: true,
      onsubmit: (event) => {
        event.preventDefault();
        const body = { name: name.value, isKid: kid.checked };
        if (group.value !== household.id) body.household = group.value || null;
        act(async () => {
          const { warning } = await api(`/api/admin/people/${person.id}`, { method: 'PATCH', body });
          editingId = null;
          await refresh();
          showMessage('familyMessage', warning ? 'warning' : 'success', warning || `Saved ${body.name.trim()}.`);
        }, (message) => (error.textContent = message));
      },
    },
    el('div', { class: 'row g-2 align-items-center' },
      el('div', { class: 'col-12 col-sm-5' }, name),
      el('div', { class: 'col-12 col-sm-7' }, group),
    ),
    el(
      'div',
      { class: 'd-flex flex-wrap align-items-center gap-2 mt-2' },
      el('label', { class: 'form-check mb-0 me-auto' }, kid, ' ', el('span', { class: 'form-check-label' }, 'Kid')),
      el('button', { type: 'submit', class: 'btn btn-sm btn-success cta-btn' }, 'Save'),
      el('button', { type: 'button', class: 'btn btn-sm btn-outline-secondary', onclick: cancelEdit }, 'Cancel'),
    ),
    person.hasAccount && el('p', { class: 'hint mb-0 mt-1' }, 'They sign in with their name, so tell them if you change it.'),
    error,
  );
  queueMicrotask(() => name.focus());
  return el('li', { class: 'admin-person admin-person--editing' }, form);
}

function startEdit(person) {
  editingId = person.id;
  showMessage('familyMessage', '', '');
  renderFamily();
}

function cancelEdit() {
  editingId = null;
  renderFamily();
}

async function resetSignIn(person) {
  const ok = await confirmDialog(
    `Reset ${person.name}'s sign-in? Their account is removed (their wishes stay), and they sign up again with their family group's code.`,
    { confirmLabel: 'Reset sign-in', danger: true },
  );
  if (!ok) return;
  act(async () => {
    await api(`/api/admin/accounts/${person.id}`, { method: 'DELETE' });
    await refresh();
    showMessage('familyMessage', 'success', `${person.name} can now sign up again with the family code.`);
  }, (message) => showMessage('familyMessage', 'danger', message));
}

async function removePerson(person) {
  const ok = await confirmDialog(`Remove ${person.name} completely? Their account, wishes and share link are deleted too.`, {
    confirmLabel: 'Remove',
    danger: true,
  });
  if (!ok) return;
  act(async () => {
    await api(`/api/admin/people/${person.id}`, { method: 'DELETE' });
    await refresh();
    showMessage('familyMessage', 'success', `Removed ${person.name}.`);
  }, (message) => showMessage('familyMessage', 'danger', message));
}

$('addPersonForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const error = event.target.querySelector('.form-error');
  error.textContent = '';
  const name = $('newName').value.trim();
  if (!name) {
    error.textContent = 'Type a name first.';
    return;
  }
  act(async () => {
    await api('/api/admin/people', {
      method: 'POST',
      body: { name, household: $('newHousehold').value || null, isKid: $('newIsKid').checked },
    });
    $('newName').value = '';
    $('newIsKid').checked = false;
    await refresh();
    showMessage('familyMessage', 'success', `Added ${name}. They can sign up with their family group's code.`);
  }, (message) => (error.textContent = message));
});

// ---------- the draw ----------

let drawFormTouched = false; // the organizer changed the year; don't reset it on re-render
$('drawYear').addEventListener('input', () => (drawFormTouched = true));

function renderDrawPanel() {
  const draw = family.currentDraw;
  const everyone = family.households.flatMap((h) => h.people.map((p) => ({ ...p, household: h.id })));
  $('drawSummary').textContent = draw
    ? `People see the ${draw.year} draw when they sign in. It has ${draw.participantIds.length} people.`
    : 'No names have been drawn yet.';

  // Someone can see their person with their own account, or through an adult in their group who has one.
  if (draw) {
    const inDraw = new Set(draw.participantIds);
    const adultAccountGroups = new Set(everyone.filter((p) => p.hasAccount && !p.isKid).map((p) => p.household));
    const waiting = everyone.filter((p) => inDraw.has(p.id) && !p.hasAccount && !adultAccountGroups.has(p.household));
    $('noAccounts').textContent = waiting.length
      ? `Can't see their person yet (no account, and no adult in their group has one): ${waiting.map((p) => p.name).join(', ')}.`
      : 'Everyone in the draw can see their person.';
    $('noAccounts').hidden = false;
  } else {
    $('noAccounts').hidden = true;
  }

  // Keep what the organizer already typed or unticked; new people start ticked.
  if (!drawFormTouched) {
    const thisYear = new Date().getFullYear();
    $('drawYear').value = draw ? Math.max(thisYear, draw.year + 1) : thisYear;
  }
  const unticked = new Set(
    [...$('participants').querySelectorAll('input:not(:checked)')].map((box) => Number(box.value)),
  );
  $('participants').replaceChildren(
    ...family.households.map((household) =>
      el(
        'div',
        { class: 'participants__household' },
        el('div', { class: 'participants__title' }, groupLabel(household)),
        household.people.map((person) =>
          el(
            'label',
            { class: 'form-check form-check-inline' },
            el('input', { class: 'form-check-input', type: 'checkbox', value: person.id, checked: !unticked.has(person.id) }),
            el('span', { class: 'form-check-label' }, person.name),
          ),
        ),
      ),
    ),
  );
}

function describeDraw(result) {
  const parts = [`Names drawn for ${result.year}: ${result.people} people. Everyone can sign in to see who they have.`];
  if (result.previousYear) {
    parts.push(
      result.samePersonRepeats
        ? `${result.samePersonRepeats} ${result.samePersonRepeats === 1 ? 'person has' : 'people have'} the same person as ${result.previousYear} (it couldn't be avoided).`
        : `Nobody has the same person as ${result.previousYear}.`,
    );
    parts.push(
      result.sameHouseholdRepeats
        ? `${result.sameHouseholdRepeats} of ${result.people} give to the same family as their group did in ${result.previousYear}, the fewest possible with these groups.`
        : `No family group gives to the same family as in ${result.previousYear}.`,
    );
  }
  return parts.join(' ');
}

$('drawForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type=submit]');
  const error = form.querySelector('.form-error');
  error.textContent = '';
  const year = Number($('drawYear').value);
  const participantIds = [...$('participants').querySelectorAll('input:checked')].map((box) => Number(box.value));
  if (participantIds.length < 2) {
    error.textContent = 'Tick at least two people.';
    return;
  }
  const newest = draws[0]?.year;
  if (newest && year > newest) {
    const ok = await confirmDialog(
      `Draw names for ${year}? As soon as you do, everyone sees their ${year} person instead of their ${newest} one. (You can undo it by deleting the ${year} draw.)`,
      { confirmLabel: `Draw ${year}` },
    );
    if (!ok) return;
  }

  button.disabled = true;
  await act(async () => {
    let result;
    try {
      result = await api('/api/admin/draws', { method: 'POST', body: { year, participantIds } });
    } catch (err) {
      if (err.status !== 409) throw err;
      const again = await confirmDialog(`${err.message} Anyone who already looked will have a different person. Draw again anyway?`, {
        confirmLabel: 'Draw again',
        danger: true,
      });
      if (!again) return;
      result = await api('/api/admin/draws', { method: 'POST', body: { year, participantIds, replace: true } });
    }
    hidePairs();
    drawFormTouched = false;
    await refresh({ showYear: result.year });
    $('drawResult').textContent = describeDraw(result);
    $('drawResult').hidden = false;
    $('drawResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, (message) => (error.textContent = message));
  button.disabled = false;
});

// ---------- who has whom ----------

function renderPairsControls(showYear) {
  const selected = Number($('pairsYear').value);
  const keep = showYear ?? (draws.some((d) => d.year === selected) ? selected : draws[0]?.year);
  $('pairsYear').replaceChildren(
    ...draws.map((d) => el('option', { value: d.year, selected: d.year === keep }, `${d.year} (${d.people} people)`)),
  );
  $('noDraws').hidden = draws.length > 0;
  $('pairsControls').hidden = draws.length === 0;
  if (showYear || !draws.some((d) => d.year === selected)) hidePairs();
}

function hidePairs() {
  $('pairs').hidden = true;
  $('pairs').replaceChildren();
  $('togglePairs').textContent = 'Show who has whom';
}

async function showPairs() {
  const year = Number($('pairsYear').value);
  const { pairs, previousYear } = await api(`/api/admin/draws/${year}`);
  const note = (pair) =>
    pair.samePersonAsLastYear
      ? `Same person as ${previousYear}`
      : pair.sameFamilyAsLastYear
        ? `Same family as ${previousYear}`
        : '';
  $('pairs').replaceChildren(
    el(
      'table',
      { class: 'table table-sm pairs-table mb-0' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Giver'), el('th', { scope: 'col' }, 'Gives to'), el('th', { scope: 'col' }, previousYear ? `vs ${previousYear}` : ''))),
      el(
        'tbody',
        {},
        pairs.map((pair) =>
          el('tr', {}, el('td', {}, pair.giver), el('td', { class: 'fw-semibold' }, pair.giftee), el('td', { class: 'hint' }, note(pair))),
        ),
      ),
    ),
  );
  $('pairs').hidden = false;
  $('togglePairs').textContent = 'Hide';
}

$('togglePairs').addEventListener('click', () => {
  $('pairsMessage').textContent = '';
  if (!$('pairs').hidden) return hidePairs();
  act(showPairs, (message) => ($('pairsMessage').textContent = message));
});

$('pairsYear').addEventListener('change', () => {
  if (!$('pairs').hidden) act(showPairs, (message) => ($('pairsMessage').textContent = message));
});

$('deleteDraw').addEventListener('click', async () => {
  const year = Number($('pairsYear').value);
  const newest = draws[0]?.year;
  const effect =
    year === newest
      ? draws[1]
        ? `It's the draw people see now; they'll see their ${draws[1].year} person again.`
        : "It's the only draw, so nobody will have a person until you draw again."
      : `People keep seeing their ${newest} person; this only removes ${year} from history.`;
  const ok = await confirmDialog(`Delete the ${year} draw? ${effect} This can't be undone.`, {
    confirmLabel: `Delete ${year}`,
    danger: true,
  });
  if (!ok) return;
  act(async () => {
    await api(`/api/admin/draws/${year}`, { method: 'DELETE' });
    hidePairs();
    $('drawResult').hidden = true;
    await refresh();
  }, (message) => ($('pairsMessage').textContent = message));
});

start();
