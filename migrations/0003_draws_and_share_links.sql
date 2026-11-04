-- One Secret Santa draw per year. The newest year is the one people see when
-- they sign in; older years are kept so the next draw can avoid repeating them.
CREATE TABLE draws (
  id INTEGER PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  created_by INTEGER REFERENCES people (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Who gives to whom in each draw. Names and households are copied in so past
-- years stay complete if someone later moves household or is removed (their id
-- then becomes NULL, but the names and households keep the history).
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY,
  draw_id INTEGER NOT NULL REFERENCES draws (id) ON DELETE CASCADE,
  giver_id INTEGER REFERENCES people (id) ON DELETE SET NULL,
  giftee_id INTEGER REFERENCES people (id) ON DELETE SET NULL,
  giver_name TEXT NOT NULL,
  giftee_name TEXT NOT NULL,
  giver_household TEXT NOT NULL,
  giftee_household TEXT NOT NULL,
  UNIQUE (draw_id, giver_id),
  UNIQUE (draw_id, giftee_id)
);
CREATE INDEX assignments_giver ON assignments (giver_id);
CREATE INDEX assignments_giftee ON assignments (giftee_id);

-- One shareable read-only link per person. The token is the whole secret in
-- the URL, so it's stored as-is: anyone who can read this table can already
-- read the wishlists it protects.
CREATE TABLE share_links (
  person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by INTEGER REFERENCES people (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
