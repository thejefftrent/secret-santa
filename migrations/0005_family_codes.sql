-- Each family group (household) has its own sign-up code. The app makes the
-- codes (the Admin page fills in any that are missing), so none are in this repo.
CREATE TABLE household_codes (
  household TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
