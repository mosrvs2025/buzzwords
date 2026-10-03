import type { ModeId } from './types';

/**
 * Game modes are pure data + scoring rules. The engine consults these, so new
 * modes (Charades, Steal, One Word…) slot in without touching the multiplayer layer.
 */
export interface ModeDef {
  id: ModeId;
  name: string;
  tagline: string;
  rules: string[];
  defaultSeconds: number;
  points: { correct: number; skip: number; foul: number };
  /** clean sweep of every card in a turn */
  sweepBonus: number;
  showNogo: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    tagline: 'Describe it. Don’t say it.',
    rules: ['Say anything except the word itself (or a piece of it).', 'Skips are free. Fouls cost a point.'],
    defaultSeconds: 60,
    points: { correct: 1, skip: 0, foul: -1 },
    sweepBonus: 3,
    showNogo: false,
  },
  nogo: {
    id: 'nogo',
    name: 'No-Go Zone',
    tagline: 'The obvious clues are banned too.',
    rules: ['Each card has No-Go words you also can’t say.', 'The other team sees them and can BUZZ you.', 'Fouls cost a point.'],
    defaultSeconds: 60,
    points: { correct: 1, skip: 0, foul: -1 },
    sweepBonus: 3,
    showNogo: true,
  },
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    tagline: '30 seconds. Skips hurt.',
    rules: ['Half the time.', 'Correct = 2 points, skip = −1.', 'Pure panic.'],
    defaultSeconds: 30,
    points: { correct: 2, skip: -1, foul: -1 },
    sweepBonus: 4,
    showNogo: false,
  },
};

export const MODE_LIST = Object.values(MODES);
