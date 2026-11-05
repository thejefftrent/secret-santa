-- An organizer can sign in as someone else (Admin → Sign in as), after typing
-- ADMIN_PASS. That session belongs to the person they signed in as, and this
-- column says which organizer started it. Deleting the organizer's account ends
-- those sessions too.
ALTER TABLE sessions ADD COLUMN impersonator_id INTEGER REFERENCES accounts (person_id) ON DELETE CASCADE;
CREATE INDEX sessions_impersonator ON sessions (impersonator_id);
