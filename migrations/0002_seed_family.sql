-- The family as of 2026 (same households as people.js), plus the wishlists
-- that used to be hard-coded in index.js.
INSERT INTO people (name, household) VALUES
  ('Shawn', 'shawn'),
  ('Darla', 'shawn'),
  ('Erika', 'erika'),
  ('Greg', 'greg'),
  ('Anna', 'greg'),
  ('Kai', 'greg'),
  ('Braxton', 'greg'),
  ('Isla', 'greg'),
  ('Matt', 'matt'),
  ('Jeff', 'jeff'),
  ('Erinn', 'jeff'),
  ('Ben', 'jeff'),
  ('Milo', 'jeff'),
  ('Erin', 'erin'),
  ('Anika', 'anika'),
  ('Edwin', 'anika');

INSERT INTO items (person_id, text) SELECT id, 'LEGO' FROM people WHERE name = 'Jeff';
INSERT INTO items (person_id, text) SELECT id, '2+ player board games' FROM people WHERE name = 'Jeff';
INSERT INTO items (person_id, text) SELECT id, 'sloth' FROM people WHERE name = 'Jeff';
INSERT INTO items (person_id, text) SELECT id, 'LEGO' FROM people WHERE name = 'Erinn';
INSERT INTO items (person_id, text) SELECT id, '2+ player board games' FROM people WHERE name = 'Erinn';
INSERT INTO items (person_id, text) SELECT id, 'Minecraft merch' FROM people WHERE name = 'Ben';
INSERT INTO items (person_id, text) SELECT id, 'Frieren merch' FROM people WHERE name = 'Ben';
INSERT INTO items (person_id, text) SELECT id, 'Super Kitties merch' FROM people WHERE name = 'Milo';
INSERT INTO items (person_id, text) SELECT id, 'Blaze and the Monster Machines or other monster truck stuff' FROM people WHERE name = 'Milo';
INSERT INTO items (person_id, text) SELECT id, 'Clothes' FROM people WHERE name = 'Milo';
INSERT INTO items (person_id, text) SELECT id, 'Construction Trucks' FROM people WHERE name = 'Milo';
