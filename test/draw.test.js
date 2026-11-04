import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DrawError, drawNames, hungarian } from '../lib/draw.js';

const FAMILY = [
  ['Shawn', 'shawn'], ['Darla', 'shawn'], ['Erika', 'erika'], ['Greg', 'greg'], ['Anna', 'greg'],
  ['Kai', 'greg'], ['Braxton', 'greg'], ['Isla', 'greg'], ['Matt', 'matt'], ['Jeff', 'jeff'],
  ['Erinn', 'jeff'], ['Ben', 'jeff'], ['Milo', 'jeff'], ['Erin', 'erin'], ['Anika', 'anika'], ['Edwin', 'anika'],
].map(([name, household], i) => ({ id: i + 1, name, household }));

// Small deterministic PRNG so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const asHistory = (pairs) =>
  pairs.map(({ giver, giftee }) => ({
    giverId: giver.id,
    gifteeId: giftee.id,
    giverHousehold: giver.household,
    gifteeHousehold: giftee.household,
  }));

function assertValid(people, pairs) {
  assert.equal(pairs.length, people.length);
  assert.equal(new Set(pairs.map((p) => p.giver.id)).size, people.length, 'everyone gives once');
  assert.equal(new Set(pairs.map((p) => p.giftee.id)).size, people.length, 'everyone receives once');
  for (const { giver, giftee } of pairs) {
    assert.notEqual(giver.id, giftee.id, `${giver.name} drew themselves`);
    assert.notEqual(giver.household, giftee.household, `${giver.name} drew ${giftee.name} from their own household`);
  }
}

function* permutations(items) {
  if (items.length <= 1) return yield items;
  for (let i = 0; i < items.length; i++) {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) yield [items[i], ...rest];
  }
}

/** Fewest (same-person, same-household) repeats over every valid assignment, by brute force. */
function bruteForceBest(people, history) {
  const lastPerson = new Set(history.map((a) => `${a.giverId}>${a.gifteeId}`));
  const lastHousehold = new Set(history.map((a) => `${a.giverHousehold}>${a.gifteeHousehold}`));
  let best = null;
  for (const perm of permutations(people)) {
    const pairs = people.map((giver, i) => ({ giver, giftee: perm[i] }));
    if (pairs.some(({ giver, giftee }) => giver.household === giftee.household)) continue;
    const score = [
      pairs.filter(({ giver, giftee }) => lastPerson.has(`${giver.id}>${giftee.id}`)).length,
      pairs.filter(({ giver, giftee }) => lastHousehold.has(`${giver.household}>${giftee.household}`)).length,
    ];
    if (!best || score[0] < best[0] || (score[0] === best[0] && score[1] < best[1])) best = score;
  }
  return best;
}

test('hungarian finds the minimum-cost assignment', () => {
  const cost = [
    [4, 1, 3],
    [2, 0, 5],
    [3, 2, 2],
  ];
  assert.deepEqual(hungarian(cost), [1, 0, 2]); // 1 + 2 + 2 = 5
});

test('the real family always gets a valid draw, with no history', () => {
  for (let seed = 1; seed <= 300; seed++) assertValid(FAMILY, drawNames(FAMILY, [], seeded(seed)).pairs);
});

test('a second year repeats no person and the same, minimal number of household pairings every time', () => {
  for (let year = 1; year <= 20; year++) {
    const last = drawNames(FAMILY, [], seeded(1000 + year));
    const counts = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const next = drawNames(FAMILY, asHistory(last.pairs), seeded(seed * 7919 + year));
      assertValid(FAMILY, next.pairs);
      assert.equal(next.samePersonRepeats, 0);
      counts.add(next.sameHouseholdRepeats);
    }
    // Every run is optimal, so they all hit the same (minimum) number of household repeats.
    assert.equal(counts.size, 1, `year ${year}: repeat counts differ between runs: ${[...counts]}`);
  }
});

test('matches brute force on small families', () => {
  const households = ['a', 'b', 'c', 'd'];
  for (let seed = 1; seed <= 60; seed++) {
    const random = seeded(seed);
    const size = 4 + Math.floor(random() * 4); // 4..7 people
    const people = Array.from({ length: size }, (_, i) => ({
      id: i + 1,
      name: `P${i + 1}`,
      household: households[Math.floor(random() * households.length)],
    }));
    const biggest = Math.max(...households.map((h) => people.filter((p) => p.household === h).length));
    if (biggest * 2 > size) {
      assert.throws(() => drawNames(people, [], random), DrawError);
      continue;
    }
    const last = drawNames(people, [], random);
    const history = asHistory(last.pairs);
    const next = drawNames(people, history, random);
    assertValid(people, next.pairs);
    assert.deepEqual([next.samePersonRepeats, next.sameHouseholdRepeats], bruteForceBest(people, history), `seed ${seed}`);
  }
});

test('draws differ from run to run', () => {
  const outcomes = new Set();
  for (let seed = 1; seed <= 50; seed++) {
    outcomes.add(drawNames(FAMILY, [], seeded(seed)).pairs.map((p) => `${p.giver.id}>${p.giftee.id}`).sort().join());
  }
  assert.ok(outcomes.size > 45, `only ${outcomes.size} distinct draws in 50 runs`);
});

test('explains impossible draws', () => {
  const people = [
    { id: 1, name: 'A', household: 'x' },
    { id: 2, name: 'B', household: 'x' },
    { id: 3, name: 'C', household: 'y' },
  ];
  assert.throws(() => drawNames(people, []), /more than half/);
  assert.throws(() => drawNames(people.slice(0, 1), []), /At least two/);
});
