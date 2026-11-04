import { api, el, joinNames, wishList } from './common.js';

const status = document.getElementById('status');
const container = document.getElementById('households');

function signInPrompt() {
  return el(
    'div',
    { class: 'col-12 col-md-9 col-lg-6 mx-auto' },
    el(
      'section',
      { class: 'panel text-center' },
      el('h2', { class: 'panel__title' }, 'Wishlists are just for family'),
      el('p', { class: 'mb-3' }, 'Sign in to see what everyone is hoping for. If someone sent you a link to their list, open that link instead.'),
      el('a', { class: 'btn btn-success btn-lg cta-btn', href: '/account?next=/wishlists' }, 'Sign in or create an account'),
    ),
  );
}

try {
  const { households } = await api('/api/wishlists');
  container.replaceChildren(
    ...households.map((household) =>
      el(
        'div',
        { class: 'col-12 col-md-6 col-xl-4' },
        el(
          'section',
          { class: 'wish-card h-100' },
          el('h2', { class: 'wish-card__title' }, joinNames(household.people)),
          household.people.map((person) =>
            el(
              'div',
              { class: 'wish-person', id: `person-${person.id}` },
              el('h3', { class: 'wish-person__name' }, person.name),
              wishList(person.items, `${person.name} hasn't added any wishes yet.`),
            ),
          ),
        ),
      ),
    ),
  );
  status.remove();
} catch (err) {
  if (err.status === 401) {
    status.remove();
    document.getElementById('ownListLink').hidden = true;
    container.replaceChildren(signInPrompt());
  } else {
    status.textContent = err.message;
  }
}
