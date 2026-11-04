// Turns a draw made by the old people.js script (its secretlist.json) into SQL
// for the database, so a year that's already been handed out keeps its pairs.
// Usage:
//
//   node scripts/import-draw.js 2026 secretlist.json draw-2026.sql
//   npx wrangler d1 execute secret-santa --remote --file draw-2026.sql
//
// The .sql file says who has whom: don't commit it (draw-*.sql is gitignored).
import fs from 'node:fs';

const [year, pairsPath, outPath] = process.argv.slice(2);
if (!/^\d{4}$/.test(year ?? '') || !pairsPath || !outPath) {
  console.error('Usage: node scripts/import-draw.js <year> <secretlist.json> <out.sql>');
  process.exit(1);
}

const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8')); // [{ name, giftTo }]
const fail = (message) => {
  console.error(`✘ ${message}`);
  process.exit(1);
};
const givers = new Set(pairs.map((p) => p.name));
const giftees = new Set();
if (givers.size !== pairs.length) fail('Someone gives twice.');
for (const { name, giftTo } of pairs) {
  if (name === giftTo) fail(`${name} gives to themselves.`);
  if (giftees.has(giftTo)) fail(`${giftTo} receives twice.`);
  if (!givers.has(giftTo)) fail(`${giftTo} receives a gift but isn't giving one.`);
  giftees.add(giftTo);
}

const q = (text) => `'${String(text).replace(/'/g, "''")}'`;
const person = (name, column) => `(SELECT ${column} FROM people WHERE name = ${q(name)})`;
const sql = [
  `-- Secret Santa ${year}, imported from people.js output. Says who has whom: don't commit or share.`,
  `-- Fails on a name the site doesn't know (giver_name would be NULL). If that happens, fix the name and`,
  `-- run: DELETE FROM draws WHERE year = ${year}`,
  `INSERT INTO draws (year) VALUES (${year});`,
  ...pairs.map(
    ({ name, giftTo }) =>
      `INSERT INTO assignments (draw_id, giver_id, giftee_id, giver_name, giftee_name, giver_household, giftee_household) VALUES (` +
      `(SELECT id FROM draws WHERE year = ${year}), ${person(name, 'id')}, ${person(giftTo, 'id')}, ` +
      `${person(name, 'name')}, ${person(giftTo, 'name')}, ${person(name, 'household')}, ${person(giftTo, 'household')});`,
  ),
  '',
].join('\n');

fs.writeFileSync(outPath, sql);
console.log(`✔ Wrote ${pairs.length} assignments for ${year} to ${outPath}`);
