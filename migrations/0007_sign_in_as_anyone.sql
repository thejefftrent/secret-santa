-- Organizers can now sign in as people who haven't made an account yet. A
-- session still always belongs to an account: from now on person_id is the
-- account that signed in, and as_person_id is who an organizer is acting as
-- (Admin → Sign in as), or NULL for an ordinary sign-in. Removing the person
-- acted as ends those sessions; deleting the organizer's account ends all of
-- theirs (person_id's cascade from 0001).
--
-- 0006's impersonator_id is no longer written. The previous version, which is
-- still live when this runs, stored the person acted as in person_id and the
-- organizer in impersonator_id. The new code ignores those sessions (they last
-- an hour at most), so the column stays: this migration only adds, and is safe
-- to apply before deploying.
ALTER TABLE sessions ADD COLUMN as_person_id INTEGER REFERENCES people (id) ON DELETE CASCADE;
CREATE INDEX sessions_as_person ON sessions (as_person_id);
