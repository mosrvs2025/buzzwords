// Core data model shared by server (authoritative) and client (presentation).

export type Phase = 'lobby' | 'turn-ready' | 'turn-live' | 'turn-review' | 'final';

export type ModeId = 'classic' | 'nogo' | 'blitz';

export type WordOutcome = 'correct' | 'skip' | 'foul' | 'missed';

export interface Card {
  word: string;
  /** "No-Go" words that may not be said while describing (used by the No-Go mode). */
  nogo?: string[];
}

export interface Player {
  id: string;
  name: string;
  avatar: number;
  teamId: string | null;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface Team {
  id: string;
  /** index into TEAM_STYLES */
  style: number;
  score: number;
  /** how many turns this team has had in the current match */
  turnsTaken: number;
}

export interface Settings {
  modeId: ModeId;
  turnSeconds: number;
  wordsPerTurn: number;
  /** how many times every player gets to describe (on the largest team) */
  laps: number;
  deckIds: string[];
  teamCount: number;
  useRoomWords: boolean;
}

export interface TurnLogEntry {
  card: Card;
  outcome: WordOutcome;
  at: number;
}

export interface Turn {
  number: number; // 1-based across match
  teamId: string;
  describerId: string;
  /** server timestamp when words start (after the 3-2-1 countdown) */
  startsAt: number | null;
  endsAt: number | null;
  cards: Card[];
  cursor: number;
  log: TurnLogEntry[];
  streak: number;
  bestStreak: number;
  foulBy?: string | null;
}

export interface CustomDeck {
  name: string;
  words: string[];
}

export interface MatchStats {
  /** per player: total correct as describer, best streak, turns described */
  byPlayer: Record<string, { correct: number; skips: number; fouls: number; bestStreak: number; turns: number; buzzes: number }>;
  history: { teamId: string; describerId: string; points: number; correct: number }[];
}

/** Full authoritative room state. Lives only on the server. */
export interface RoomState {
  code: string;
  createdAt: number;
  updatedAt: number;
  hostId: string | null;
  phase: Phase;
  players: Player[];
  teams: Team[];
  settings: Settings;
  /** collaborative anonymous word jar */
  roomWords: { word: string; by: string }[];
  customDeck: CustomDeck | null;
  turn: Turn | null;
  turnsPerTeam: number;
  matchNumber: number;
  /** remaining shuffled words for this match (secret) */
  pool: Card[];
  used: string[];
  stats: MatchStats;
  seq: number;
}

// ---- Client view (what a given device is allowed to know) ----

export type Role = 'describer' | 'guesser' | 'judge' | 'spectator' | 'display';

export interface TurnView {
  number: number;
  teamId: string;
  describerId: string;
  startsAt: number | null;
  endsAt: number | null;
  total: number;
  cursor: number;
  outcomes: WordOutcome[];
  streak: number;
  points: number;
  /** only for describer + opposing-team judges while live */
  card: Card | null;
  /** revealed only once the turn is over */
  revealed: TurnLogEntry[] | null;
}

export interface RoomView {
  code: string;
  phase: Phase;
  hostId: string | null;
  players: Player[];
  teams: Team[];
  settings: Settings;
  turn: TurnView | null;
  turnsPerTeam: number;
  totalTurns: number;
  turnsPlayed: number;
  matchNumber: number;
  roomWordCount: number;
  myRoomWords: string[];
  customDeckName: string | null;
  customDeckSize: number;
  stats: MatchStats;
  me: { id: string | null; role: Role };
  canStart: { ok: boolean; reason?: string };
}

// ---- Actions (client -> server) ----

export type Action =
  | { type: 'rename'; name: string; avatar: number }
  | { type: 'ready'; ready: boolean }
  | { type: 'setTeam'; playerId: string; teamId: string }
  | { type: 'shuffleTeams' }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'addRoomWord'; word: string }
  | { type: 'removeRoomWord'; word: string }
  | { type: 'setCustomDeck'; deck: CustomDeck | null }
  | { type: 'kick'; playerId: string }
  | { type: 'startMatch' }
  | { type: 'beginTurn' }
  | { type: 'mark'; outcome: 'correct' | 'skip'; cursor: number }
  | { type: 'foul'; cursor: number }
  | { type: 'endTurnEarly' }
  | { type: 'review'; index: number; outcome: WordOutcome }
  | { type: 'confirmTurn' }
  | { type: 'passTurn' }
  | { type: 'endMatch' }
  | { type: 'rematch' }
  | { type: 'backToLobby' }
  | { type: 'react'; emoji: string };

// ---- Ephemeral events for animation / sound ----

export type GameEvent =
  | { kind: 'correct'; teamId: string; streak: number; points: number }
  | { kind: 'skip'; teamId: string }
  | { kind: 'foul'; teamId: string; by: string }
  | { kind: 'turn-start'; teamId: string; describerId: string }
  | { kind: 'turn-end'; teamId: string; points: number; sweep: boolean }
  | { kind: 'match-end'; winners: string[] }
  | { kind: 'react'; emoji: string; by: string }
  | { kind: 'join'; name: string };

// ---- Wire protocol ----

export type ClientMsg =
  | { t: 'hello'; room: string; playerId?: string; token?: string; name?: string; avatar?: number; display?: boolean }
  | { t: 'action'; action: Action }
  | { t: 'ping'; c: number };

export type ServerMsg =
  | { t: 'welcome'; playerId: string | null; token: string | null }
  | { t: 'state'; view: RoomView; now: number }
  | { t: 'event'; ev: GameEvent; now: number }
  | { t: 'error'; message: string; fatal?: boolean }
  | { t: 'pong'; c: number; s: number };
