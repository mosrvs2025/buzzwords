/**
 * Avatar "looks": a small set of indices into part catalogs. Pure data so
 * the server can validate it and future cosmetics (shop, seasonal, earned)
 * slot in as catalog entries.
 */

export interface Unlock {
  /** matches played */
  games?: number;
  /** matches won */
  wins?: number;
  /** future premium/season pass id; locked for now */
  pass?: string;
}

export interface Part {
  name: string;
  unlock?: Unlock;
}

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
  brows: number;
  facial: number;
  glasses: number;
  hat: number;
  top: number;
  topColor: number;
}

export const SKINS = ['#FFE0C7', '#F6C9A4', '#E9B189', '#D49668', '#B57749', '#8E5735', '#6A3F24', '#4B2B19'];
export const HAIR_COLORS = ['#1D1A2B', '#3B2417', '#6B3E1F', '#A8642A', '#E0AE4E', '#F3DC8B', '#BDBDC6', '#FF6FA5', '#3A5BFF', '#2FBF55'];
export const TOP_COLORS = ['#FF4D2E', '#00B8A9', '#FFC22E', '#3A5BFF', '#FF7BAC', '#2FBF55', '#1D1A2B', '#FFF7EA', '#7A4BD6', '#E07A1F'];

export const CATALOG = {
  hair: [
    { name: 'Bald' },
    { name: 'Buzz' },
    { name: 'Side part' },
    { name: 'Curls' },
    { name: 'Messy' },
    { name: 'Top bun' },
    { name: 'Long' },
    { name: 'Bob' },
    { name: 'Afro' },
    { name: 'Mohawk', unlock: { games: 3 } },
    { name: 'Space buns', unlock: { games: 5 } },
  ],
  eyes: [{ name: 'Dots' }, { name: 'Bright' }, { name: 'Lashes' }, { name: 'Chill' }, { name: 'Starry', unlock: { wins: 1 } }],
  brows: [{ name: 'Soft' }, { name: 'Arched' }, { name: 'Bold' }, { name: 'Serious' }, { name: 'None' }],
  facial: [
    { name: 'None' },
    { name: 'Stubble' },
    { name: 'Mustache' },
    { name: 'Beard' },
    { name: 'Goatee' },
    { name: 'Wizard beard', unlock: { games: 2 } },
  ],
  glasses: [
    { name: 'None' },
    { name: 'Round' },
    { name: 'Square' },
    { name: 'Shades' },
    { name: 'Heart shades', unlock: { games: 4 } },
    { name: 'Star shades', unlock: { wins: 2 } },
  ],
  hat: [
    { name: 'None' },
    { name: 'Beanie' },
    { name: 'Cap' },
    { name: 'Headphones' },
    { name: 'Cat ears', unlock: { games: 1 } },
    { name: 'Bucket hat' },
    { name: 'Halo', unlock: { games: 6 } },
    { name: 'Crown', unlock: { wins: 3 } },
    { name: 'Party hat', unlock: { pass: 'party' } },
  ],
  top: [
    { name: 'Tee' },
    { name: 'Hoodie' },
    { name: 'Collared' },
    { name: 'Jersey' },
    { name: 'Sweater' },
    { name: 'Overalls' },
    { name: 'Suit', unlock: { wins: 1 } },
    { name: 'Sequin jacket', unlock: { pass: 'party' } },
  ],
} satisfies Record<string, Part[]>;

export type PartKey = keyof typeof CATALOG;

const SIZES: Record<keyof Look, number> = {
  skin: SKINS.length,
  hair: CATALOG.hair.length,
  hairColor: HAIR_COLORS.length,
  eyes: CATALOG.eyes.length,
  brows: CATALOG.brows.length,
  facial: CATALOG.facial.length,
  glasses: CATALOG.glasses.length,
  hat: CATALOG.hat.length,
  top: CATALOG.top.length,
  topColor: TOP_COLORS.length,
};

export function isUnlocked(u: Unlock | undefined, p: { games: number; wins: number }): boolean {
  if (!u) return true;
  if (u.pass) return false;
  return p.games >= (u.games ?? 0) && p.wins >= (u.wins ?? 0);
}

export function describeUnlock(u: Unlock): string {
  if (u.pass) return 'Coming soon';
  if (u.wins) return `Win ${u.wins} game${u.wins > 1 ? 's' : ''}`;
  return `Play ${u.games} game${u.games! > 1 ? 's' : ''}`;
}

export function randomLook(rng: () => number = Math.random): Look {
  const pick = (k: keyof Look, freeOnly = true) => {
    const cat = (CATALOG as Record<string, Part[]>)[k];
    const n = SIZES[k];
    for (;;) {
      const i = Math.floor(rng() * n);
      if (!freeOnly || !cat || !cat[i].unlock) return i;
    }
  };
  return {
    skin: pick('skin'),
    hair: pick('hair'),
    hairColor: Math.floor(rng() * 7),
    eyes: pick('eyes'),
    brows: pick('brows'),
    facial: rng() < 0.6 ? 0 : pick('facial'),
    glasses: rng() < 0.6 ? 0 : pick('glasses'),
    hat: rng() < 0.6 ? 0 : pick('hat'),
    top: pick('top'),
    topColor: pick('topColor'),
  };
}

/** Clamp an untrusted look from the wire. */
export function sanitizeLook(x: unknown): Look {
  const base = randomLook();
  if (!x || typeof x !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(SIZES) as (keyof Look)[]) {
    const v = (x as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < SIZES[k]) out[k] = v;
  }
  return out;
}

export const DEFAULT_LOOK: Look = { skin: 1, hair: 2, hairColor: 1, eyes: 0, brows: 0, facial: 0, glasses: 0, hat: 0, top: 0, topColor: 1 };
