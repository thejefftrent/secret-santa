// The Secret Santa draw, as a minimum-cost assignment of givers to giftees.
//
// Hard rules: nobody gives to themselves or to someone in their own household.
// Soft rules, compared with last year's draw:
//   1. avoid giving to the same person as last year (very expensive), then
//   2. avoid a household giving to the same other household as last year
//      (e.g. if someone in Greg's household gave to someone in Jeff's last year,
//      try not to have Greg's household give to Jeff's household again).
// The Hungarian algorithm finds an assignment with the fewest repeats possible;
// small random noise on every pairing picks a random one among the best.
// No Workers- or Node-specific APIs, so tests can run it with plain Node.

export class DrawError extends Error {}

/** Uniform random number in [0, 1) from the platform CSPRNG. */
export function secureRandom() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Minimum-cost perfect matching on a square cost matrix (Hungarian algorithm,
 * O(n^3)). Returns `match` where row i is assigned column match[i].
 */
export function hungarian(cost) {
  const n = cost.length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0); // p[j] = row matched to column j (1-based, 0 = none)
  const way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(Infinity);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const match = new Array(n);
  for (let j = 1; j <= n; j++) match[p[j] - 1] = j - 1;
  return match;
}

/**
 * @param {{id:number, name:string, household:string}[]} participants
 * @param {{giverId:number, gifteeId:number, giverHousehold:string, gifteeHousehold:string}[]} previous
 *   last year's assignments ([] if there was no draw)
 * @param {() => number} random uniform [0, 1); injectable for tests
 * @returns {{ pairs: {giver, giftee}[], samePersonRepeats: number, sameHouseholdRepeats: number }}
 */
export function drawNames(participants, previous = [], random = secureRandom) {
  const n = participants.length;
  if (n < 2) throw new DrawError('At least two people need to be in the draw.');
  if (new Set(participants.map((p) => p.id)).size !== n) throw new DrawError('Someone is in the draw twice.');

  // A household with more than half the people can't all give outside it.
  const sizes = new Map();
  for (const p of participants) sizes.set(p.household, (sizes.get(p.household) ?? 0) + 1);
  for (const [household, size] of sizes) {
    if (size * 2 > n) {
      const names = participants.filter((p) => p.household === household).map((p) => p.name);
      throw new DrawError(
        `${names.join(', ')} are more than half of the draw, so some of them would have to give to each other. Add more people or leave some out.`,
      );
    }
  }

  const lastPerson = new Set(previous.map((a) => `${a.giverId}>${a.gifteeId}`));
  const lastHousehold = new Set(previous.map((a) => `${a.giverHousehold}>${a.gifteeHousehold}`));

  // Costs are layered so each rule strictly outranks the ones below it:
  // total noise < n < HOUSEHOLD, and all household repeats (n * HOUSEHOLD) < PERSON.
  const HOUSEHOLD = n + 1;
  const PERSON = HOUSEHOLD * (n + 1);
  const FORBIDDEN = PERSON * (n + 2) * 2;

  const order = shuffle([...participants], random);
  const cost = order.map((giver) =>
    order.map((giftee) => {
      if (giver.id === giftee.id || giver.household === giftee.household) return FORBIDDEN;
      let c = random();
      if (lastHousehold.has(`${giver.household}>${giftee.household}`)) c += HOUSEHOLD;
      if (lastPerson.has(`${giver.id}>${giftee.id}`)) c += PERSON;
      return c;
    }),
  );

  const match = hungarian(cost);
  const pairs = order.map((giver, i) => ({ giver, giftee: order[match[i]] }));

  for (const { giver, giftee } of pairs) {
    if (giver.id === giftee.id || giver.household === giftee.household) {
      throw new DrawError("Couldn't find a draw where everyone gives outside their household.");
    }
  }
  return {
    pairs,
    samePersonRepeats: pairs.filter(({ giver, giftee }) => lastPerson.has(`${giver.id}>${giftee.id}`)).length,
    sameHouseholdRepeats: pairs.filter(({ giver, giftee }) => lastHousehold.has(`${giver.household}>${giftee.household}`))
      .length,
  };
}
