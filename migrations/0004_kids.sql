-- Adults manage everyone in their household (partner and kids): their lists,
-- share links and Secret Santa person. Kids only see and change their own.
ALTER TABLE people ADD COLUMN is_kid INTEGER NOT NULL DEFAULT 0;
UPDATE people SET is_kid = 1 WHERE name IN ('Kai', 'Braxton', 'Isla', 'Ben', 'Milo');
