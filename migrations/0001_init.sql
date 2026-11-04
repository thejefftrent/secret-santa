-- Everyone who can have a wishlist. Kids don't need an account: anyone in the
-- same household can edit their list.
CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  household TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX people_household ON people (household);

-- A sign-in for one person. Deleting a row lets that person sign up again.
CREATE TABLE accounts (
  person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Only a SHA-256 of the cookie token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES accounts (person_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_person ON sessions (person_id);

CREATE TABLE items (
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX items_person ON items (person_id);

-- Failed sign-in / sign-up attempts, for throttling password and family-code guessing.
CREATE TABLE auth_failures (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX auth_failures_key ON auth_failures (key, at);
CREATE INDEX auth_failures_at ON auth_failures (at); -- for pruning old rows without a full scan
