// Sign-up codes for family groups, like "jolly-reindeer-42": easy to read out
// loud, with about 175,000 possibilities. Sign-up guesses are throttled per
// device and per family group, so they can't be guessed in practice.
import { secureRandom } from './draw.js';

const ADJECTIVES = [
  'adorable', 'amazing', 'beautiful', 'brave', 'bright', 'calm', 'caring', 'charming', 'clever', 'cool',
  'creative', 'cute', 'dazzling', 'delightful', 'determined', 'diligent', 'dreamy', 'eager', 'elegant',
  'energetic', 'excellent', 'excited', 'exotic', 'fabulous', 'fancy', 'fantastic', 'fierce', 'friendly',
  'funny', 'generous', 'gentle', 'glowing', 'good', 'graceful', 'great', 'happy', 'healthy', 'helpful',
  'honest', 'honorable', 'impressive', 'incredible', 'jolly', 'joyful', 'kind', 'lovely', 'lucky', 'nice',
  'perfect', 'polite', 'pretty', 'proud', 'radiant', 'romantic', 'silly', 'smart', 'special', 'splendid',
  'successful', 'super', 'talented', 'terrific', 'tough', 'tremendous', 'trusty', 'unusual', 'valiant',
  'victorious', 'wonderful', 'worthy', 'zealous', 'zany',
];
const WORDS = [
  'christmas', 'holiday', 'winter', 'snow', 'santa', 'gift', 'stocking', 'mistletoe', 'candycane', 'elf',
  'reindeer', 'snowman', 'penguin', 'gingerbread', 'pinetree', 'snowflake', 'ornament', 'wreath', 'candle',
  'peace', 'love', 'family', 'friends', 'gifts', 'giving', 'faith', 'hope',
];

export function newFamilyCode(random = secureRandom) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  return `${pick(ADJECTIVES)}-${pick(WORDS)}-${10 + Math.floor(random() * 90)}`;
}

/** Forgive capitals, stray spaces, and spaces typed instead of dashes. */
export function normalizeCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '-') : '';
}
