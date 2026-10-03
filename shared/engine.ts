/**
 * Pure-ish game rules. The server owns one RoomState per room and feeds it
 * actions + clock ticks; the engine mutates the state and returns events
 * for clients to animate. Nothing here knows about sockets or React.
 */
import { DECK_BY_ID } from './decks';
import { MODES } from './modes';
import { TEAM_STYLES } from './style';
import type {
  Action, Card, GameEvent, Player, Role, RoomState, RoomView, Settings, Team, Turn, TurnView, WordOutcome,
} from './types';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;
export const COUNTDOWN_MS = 3000;
/** taps that land just after the buzzer (network latency) still count */
export const GRACE_MS = 400;
export const MAX_ROOM_WORDS = 120;

export type Rng = () => number;

export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg);
};

export function defaultSettings(): Settings {
  return { modeId: 'classic', turnSeconds: 60, wordsPerTurn: 10, laps: 1, deckIds: ['party'], teamCount: 0, useRoomWords: true };
}

export function createRoom(code: string, now: number): RoomState {
  return {
    code,
    createdAt: now,
    updatedAt: now,
    hostId: null,
    phase: 'lobby',
    players: [],
    teams: [],
    settings: defaultSettings(),
    roomWords: [],
    customDeck: null,
    turn: null,
    turnsPerTeam: 0,
    matchNumber: 0,
    pool: [],
    used: [],
    stats: { byPlayer: {}, history: [] },
    seq: 0,
  };
}

// ---------- helpers ----------

export function autoTeamCount(n: number): number {
  // 4-5 → 2 teams, 6-7 → 3, 8+ → 4 (every team keeps ≥2 players)
  return Math.max(2, Math.min(4, Math.floor(n / 2)));
}

export function effectiveTeamCount(s: RoomState): number {
  const n = s.players.length;
  const wanted = s.settings.teamCount || autoTeamCount(n);
  return Math.max(2, Math.min(4, wanted));
}

export function teamMembers(s: RoomState, teamId: string): Player[] {
  return s.players.filter((p) => p.teamId === teamId).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function effectiveHost(s: RoomState): string | null {
  const host = s.players.find((p) => p.id === s.hostId);
  if (host?.connected) return host.id;
  const first = [...s.players].filter((p) => p.connected).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  return first?.id ?? host?.id ?? null;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function smallestTeam(s: RoomState): Team {
  return [...s.teams].sort((a, b) => teamMembers(s, a.id).length - teamMembers(s, b.id).length || a.style - b.style)[0];
}

/** Keep the team list in sync with the desired team count (lobby only). */
export function syncTeams(s: RoomState): void {
  const count = effectiveTeamCount(s);
  while (s.teams.length < count) {
    const used = new Set(s.teams.map((t) => t.style));
    const style = TEAM_STYLES.findIndex((_, i) => !used.has(i));
    s.teams.push({ id: `t${style}`, style, score: 0, turnsTaken: 0 });
  }
  if (s.teams.length > count) {
    const removed = s.teams.splice(count);
    const removedIds = new Set(removed.map((t) => t.id));
    for (const p of s.players) if (p.teamId && removedIds.has(p.teamId)) p.teamId = null;
  }
  for (const p of s.players) if (!p.teamId) p.teamId = smallestTeam(s).id;
  // rebalance: nobody should be stuck on a team that's 2+ bigger than another
  if (s.phase === 'lobby') {
    for (let guard = 0; guard < 20; guard++) {
      const sizes = s.teams.map((t) => ({ t, m: teamMembers(s, t.id) })).sort((a, b) => b.m.length - a.m.length);
      if (sizes[0].m.length - sizes[sizes.length - 1].m.length < 2) break;
      const mover = sizes[0].m[sizes[0].m.length - 1];
      mover.teamId = sizes[sizes.length - 1].t.id;
    }
  }
}

export function sanitizeName(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || 'Player';
}

export function sanitizeWord(word: string): string {
  return word.replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

export function addPlayer(s: RoomState, p: { id: string; name: string; avatar: number }, now: number): Player {
  if (s.players.length >= MAX_PLAYERS) fail('Room is full');
  const player: Player = {
    id: p.id,
    name: uniqueName(s, sanitizeName(p.name)),
    avatar: Math.abs(Math.floor(p.avatar)) % 1000,
    teamId: null,
    connected: true,
    ready: false,
    joinedAt: now + s.players.length * 0.001,
    lastSeenAt: now,
  };
  s.players.push(player);
  if (!s.hostId) s.hostId = player.id;
  if (s.phase === 'lobby') syncTeams(s);
  else player.teamId = smallestTeam(s).id; // late joiner: becomes a guesser on the smallest team
  return player;
}

function uniqueName(s: RoomState, name: string, selfId?: string): string {
  const taken = new Set(s.players.filter((p) => p.id !== selfId).map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const n = `${name.slice(0, 13)} ${i}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
}

export function removePlayer(s: RoomState, id: string, now: number, rng: Rng): GameEvent[] {
  const idx = s.players.findIndex((p) => p.id === id);
  if (idx < 0) return [];
  s.players.splice(idx, 1);
  s.roomWords = s.roomWords.filter((w) => w.by !== id);
  if (s.hostId === id) s.hostId = [...s.players].sort((a, b) => a.joinedAt - b.joinedAt)[0]?.id ?? null;
  const events: GameEvent[] = [];
  if (s.phase === 'lobby') syncTeams(s);
  else if (s.turn && s.turn.describerId === id) {
    if (s.phase === 'turn-ready') pickDescriber(s, s.turn, true);
    else if (s.phase === 'turn-live') events.push(...endTurn(s, now));
  }
  // a team emptied out mid-game: end the match gracefully rather than wedge it
  if (s.phase !== 'lobby' && s.phase !== 'final' && s.teams.some((t) => teamMembers(s, t.id).length === 0)) {
    events.push(...finishMatch(s));
  }
  void rng;
  return events;
}

export function canStart(s: RoomState): { ok: boolean; reason?: string } {
  if (s.players.length < MIN_PLAYERS) return { ok: false, reason: `Need ${MIN_PLAYERS - s.players.length} more player${MIN_PLAYERS - s.players.length === 1 ? '' : 's'}` };
  for (const t of s.teams) {
    if (teamMembers(s, t.id).length < 2) return { ok: false, reason: `Team ${TEAM_STYLES[t.style].name} needs 2+ players` };
  }
  if (buildDeck(s).length < s.settings.wordsPerTurn) return { ok: false, reason: 'Pick at least one deck' };
  return { ok: true };
}

export function buildDeck(s: RoomState): Card[] {
  const seen = new Set<string>();
  const out: Card[] = [];
  const push = (c: Card) => {
    const k = c.word.toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  // a custom deck replaces built-ins when it's big enough to carry a game on its own
  if (s.customDeck) s.customDeck.words.forEach((w) => push({ word: w }));
  if (!s.customDeck || s.customDeck.words.length < 30) {
    for (const id of s.settings.deckIds) DECK_BY_ID[id]?.cards.forEach(push);
  }
  if (s.settings.useRoomWords) s.roomWords.forEach((w) => push({ word: w.word }));
  return out;
}

function turnsPlayed(s: RoomState): number {
  return s.teams.reduce((n, t) => n + t.turnsTaken, 0);
}

function pickDescriber(s: RoomState, turn: Turn, advance = false): void {
  const team = s.teams.find((t) => t.id === turn.teamId)!;
  const members = teamMembers(s, team.id);
  if (!members.length) return;
  let i = advance ? members.findIndex((m) => m.id === turn.describerId) + 1 : team.turnsTaken;
  // prefer someone who is actually here
  for (let k = 0; k < members.length; k++) {
    const m = members[(i + k) % members.length];
    if (m.connected) {
      turn.describerId = m.id;
      return;
    }
  }
  turn.describerId = members[i % members.length].id;
}

function setupTurn(s: RoomState): void {
  const played = turnsPlayed(s);
  const order = s.teams.length;
  const team = s.teams[(played + s.matchNumber) % order];
  const turn: Turn = {
    number: played + 1,
    teamId: team.id,
    describerId: '',
    startsAt: null,
    endsAt: null,
    cards: [],
    cursor: 0,
    log: [],
    streak: 0,
    bestStreak: 0,
  };
  pickDescriber(s, turn);
  s.turn = turn;
  s.phase = 'turn-ready';
}

function deal(s: RoomState, n: number, rng: Rng): Card[] {
  const out: Card[] = [];
  while (out.length < n) {
    if (!s.pool.length) {
      const fresh = buildDeck(s).filter((c) => !s.used.includes(c.word));
      s.pool = shuffle(fresh.length >= n ? fresh : buildDeck(s), rng);
      if (fresh.length < n) s.used = [];
      if (!s.pool.length) break;
    }
    const c = s.pool.pop()!;
    if (out.some((o) => o.word === c.word)) continue;
    out.push(c);
  }
  return out;
}

export function turnPoints(s: RoomState, turn: Turn): { points: number; sweep: boolean } {
  const mode = MODES[s.settings.modeId];
  let points = 0;
  for (const e of turn.log) {
    if (e.outcome === 'correct') points += mode.points.correct;
    else if (e.outcome === 'skip') points += mode.points.skip;
    else if (e.outcome === 'foul') points += mode.points.foul;
  }
  const sweep = turn.cards.length > 0 && turn.log.length === turn.cards.length && turn.log.every((e) => e.outcome === 'correct');
  if (sweep) points += mode.sweepBonus;
  return { points, sweep };
}

function endTurn(s: RoomState, now: number): GameEvent[] {
  const turn = s.turn;
  if (!turn || s.phase !== 'turn-live') return [];
  // the card on screen when the buzzer went is revealed as "missed"
  if (turn.cursor < turn.cards.length && turn.startsAt !== null && now >= turn.startsAt) {
    turn.log.push({ card: turn.cards[turn.cursor], outcome: 'missed', at: now });
  }
  // unseen cards go back into the pool
  const seen = new Set(turn.log.map((e) => e.card.word));
  for (const c of turn.cards) if (!seen.has(c.word)) s.pool.unshift(c);
  turn.cards = turn.cards.filter((c) => seen.has(c.word));
  turn.cursor = turn.cards.length;
  s.phase = 'turn-review';
  const { points, sweep } = turnPoints(s, turn);
  return [{ kind: 'turn-end', teamId: turn.teamId, points, sweep }];
}

function finishMatch(s: RoomState): GameEvent[] {
  s.phase = 'final';
  s.turn = null;
  const top = Math.max(...s.teams.map((t) => t.score));
  return [{ kind: 'match-end', winners: s.teams.filter((t) => t.score === top).map((t) => t.id) }];
}

function startMatch(s: RoomState, rng: Rng): GameEvent[] {
  const ok = canStart(s);
  if (!ok.ok) fail(ok.reason!);
  for (const t of s.teams) {
    t.score = 0;
    t.turnsTaken = 0;
  }
  const maxSize = Math.max(...s.teams.map((t) => teamMembers(s, t.id).length));
  s.turnsPerTeam = Math.max(1, s.settings.laps * maxSize);
  s.pool = shuffle(buildDeck(s), rng);
  s.used = [];
  s.stats = { byPlayer: {}, history: [] };
  s.matchNumber++;
  setupTurn(s);
  return [{ kind: 'turn-start', teamId: s.turn!.teamId, describerId: s.turn!.describerId }];
}

function stat(s: RoomState, id: string) {
  return (s.stats.byPlayer[id] ??= { correct: 0, skips: 0, fouls: 0, bestStreak: 0, turns: 0, buzzes: 0 });
}

// ---------- the reducer ----------

export function applyAction(s: RoomState, actorId: string, a: Action, now: number, rng: Rng = Math.random): GameEvent[] {
  const actor = s.players.find((p) => p.id === actorId);
  if (!actor) fail('You are not in this room');
  const me = actor!;
  const isHost = effectiveHost(s) === me.id;
  const needHost = () => !isHost && fail('Only the host can do that');
  const needPhase = (...ph: RoomState['phase'][]) => !ph.includes(s.phase) && fail('Not right now');
  const turn = s.turn;

  switch (a.type) {
    case 'rename': {
      me.name = uniqueName(s, sanitizeName(a.name), me.id);
      me.avatar = Math.abs(Math.floor(a.avatar)) % 1000;
      return [];
    }
    case 'ready':
      me.ready = !!a.ready;
      return [];
    case 'setTeam': {
      needPhase('lobby');
      // players may switch themselves; the host may move anyone
      if (a.playerId !== me.id) needHost();
      const p = s.players.find((x) => x.id === a.playerId) ?? fail('No such player');
      if (!s.teams.some((t) => t.id === a.teamId)) fail('No such team');
      p.teamId = a.teamId;
      return [];
    }
    case 'shuffleTeams': {
      needPhase('lobby');
      needHost();
      const order = shuffle(s.players, rng);
      order.forEach((p, i) => (p.teamId = s.teams[i % s.teams.length].id));
      return [];
    }
    case 'settings': {
      needPhase('lobby', 'final');
      needHost();
      const p = a.patch;
      const st = s.settings;
      if (p.modeId && MODES[p.modeId]) {
        st.modeId = p.modeId;
        st.turnSeconds = MODES[p.modeId].defaultSeconds;
      }
      if (p.turnSeconds !== undefined) st.turnSeconds = clamp(Math.round(p.turnSeconds), 15, 120);
      if (p.wordsPerTurn !== undefined) st.wordsPerTurn = clamp(Math.round(p.wordsPerTurn), 5, 20);
      if (p.laps !== undefined) st.laps = clamp(Math.round(p.laps), 1, 3);
      if (p.teamCount !== undefined) st.teamCount = p.teamCount === 0 ? 0 : clamp(Math.round(p.teamCount), 2, 4);
      if (p.useRoomWords !== undefined) st.useRoomWords = !!p.useRoomWords;
      if (p.deckIds) st.deckIds = p.deckIds.filter((id) => DECK_BY_ID[id]).slice(0, 10);
      if (s.phase === 'lobby') syncTeams(s);
      return [];
    }
    case 'addRoomWord': {
      needPhase('lobby', 'final');
      const w = sanitizeWord(a.word);
      if (w.length < 2) fail('Too short');
      if (s.roomWords.length >= MAX_ROOM_WORDS) fail('The jar is full!');
      if (s.roomWords.some((x) => x.word.toLowerCase() === w.toLowerCase())) fail('Someone already added that one 👀');
      s.roomWords.push({ word: w, by: me.id });
      return [];
    }
    case 'removeRoomWord': {
      s.roomWords = s.roomWords.filter((x) => !(x.by === me.id && x.word === a.word));
      return [];
    }
    case 'setCustomDeck': {
      needPhase('lobby', 'final');
      needHost();
      if (!a.deck) {
        s.customDeck = null;
        return [];
      }
      const words = [...new Set(a.deck.words.map(sanitizeWord).filter((w) => w.length >= 2))].slice(0, 500);
      if (words.length < 10) fail('A deck needs at least 10 words');
      s.customDeck = { name: sanitizeName(a.deck.name || 'Custom deck').slice(0, 32), words };
      return [];
    }
    case 'kick': {
      needHost();
      if (a.playerId === me.id) fail('You can’t kick yourself');
      return removePlayer(s, a.playerId, now, rng);
    }
    case 'startMatch':
      needPhase('lobby');
      needHost();
      return startMatch(s, rng);
    case 'rematch':
      needPhase('final');
      needHost();
      return startMatch(s, rng);
    case 'backToLobby':
      needPhase('final');
      needHost();
      s.phase = 'lobby';
      s.turn = null;
      for (const p of s.players) p.ready = false;
      for (const t of s.teams) t.score = 0;
      syncTeams(s);
      return [];
    case 'endMatch':
      needHost();
      if (s.phase === 'lobby' || s.phase === 'final') fail('Not right now');
      return finishMatch(s);
    case 'passTurn': {
      needPhase('turn-ready');
      if (turn!.describerId !== me.id) needHost();
      pickDescriber(s, turn!, true);
      return [{ kind: 'turn-start', teamId: turn!.teamId, describerId: turn!.describerId }];
    }
    case 'beginTurn': {
      needPhase('turn-ready');
      if (turn!.describerId !== me.id) fail('It’s not your turn to describe');
      turn!.cards = deal(s, s.settings.wordsPerTurn, rng);
      turn!.cards.forEach((c) => s.used.push(c.word));
      turn!.startsAt = now + COUNTDOWN_MS;
      turn!.endsAt = turn!.startsAt + s.settings.turnSeconds * 1000;
      s.phase = 'turn-live';
      return [];
    }
    case 'mark': {
      needPhase('turn-live');
      const t = turn!;
      if (t.describerId !== me.id) fail('Only the describer can mark words');
      if (a.cursor !== t.cursor) return []; // duplicate / stale tap — ignore quietly
      if (now < t.startsAt! - 250) fail('Wait for it…');
      if (now > t.endsAt! + GRACE_MS) return endTurn(s, now);
      t.log.push({ card: t.cards[t.cursor], outcome: a.outcome, at: now });
      t.cursor++;
      const ev: GameEvent[] = [];
      const st = stat(s, me.id);
      if (a.outcome === 'correct') {
        t.streak++;
        t.bestStreak = Math.max(t.bestStreak, t.streak);
        st.correct++;
        st.bestStreak = Math.max(st.bestStreak, t.streak);
        ev.push({ kind: 'correct', teamId: t.teamId, streak: t.streak, points: turnPoints(s, t).points });
      } else {
        t.streak = 0;
        st.skips++;
        ev.push({ kind: 'skip', teamId: t.teamId });
      }
      if (t.cursor >= t.cards.length) ev.push(...endTurn(s, now));
      return ev;
    }
    case 'foul': {
      needPhase('turn-live');
      const t = turn!;
      if (!me.teamId || me.teamId === t.teamId) fail('Only the other team can buzz');
      if (a.cursor !== t.cursor) return [];
      if (now < t.startsAt! || now > t.endsAt! + GRACE_MS) return [];
      t.log.push({ card: t.cards[t.cursor], outcome: 'foul', at: now });
      t.cursor++;
      t.streak = 0;
      stat(s, t.describerId).fouls++;
      stat(s, me.id).buzzes++;
      const ev: GameEvent[] = [{ kind: 'foul', teamId: t.teamId, by: me.id }];
      if (t.cursor >= t.cards.length) ev.push(...endTurn(s, now));
      return ev;
    }
    case 'endTurnEarly': {
      needPhase('turn-live');
      if (turn!.describerId !== me.id) needHost();
      return endTurn(s, now);
    }
    case 'review': {
      needPhase('turn-review');
      const t = turn!;
      if (t.describerId !== me.id) needHost();
      const e = t.log[a.index] ?? fail('No such word');
      if (!['correct', 'skip', 'missed', 'foul'].includes(a.outcome)) fail('Bad outcome');
      e.outcome = a.outcome as WordOutcome;
      return [];
    }
    case 'confirmTurn': {
      needPhase('turn-review');
      const t = turn!;
      if (t.describerId !== me.id && me.teamId !== t.teamId) needHost();
      const team = s.teams.find((x) => x.id === t.teamId)!;
      const { points } = turnPoints(s, t);
      team.score += points;
      team.turnsTaken++;
      stat(s, t.describerId).turns++;
      s.stats.history.push({
        teamId: t.teamId,
        describerId: t.describerId,
        points,
        correct: t.log.filter((e) => e.outcome === 'correct').length,
      });
      if (s.teams.every((x) => x.turnsTaken >= s.turnsPerTeam)) return finishMatch(s);
      setupTurn(s);
      return [{ kind: 'turn-start', teamId: s.turn!.teamId, describerId: s.turn!.describerId }];
    }
    case 'react': {
      if (!['😂', '🔥', '😱', '👏', '🤦', '💀'].includes(a.emoji)) return [];
      return [{ kind: 'react', emoji: a.emoji, by: me.id }];
    }
  }
  return [];
}

/** Clock tick — ends turns whose time has run out. */
export function tick(s: RoomState, now: number): GameEvent[] {
  if (s.phase === 'turn-live' && s.turn?.endsAt && now >= s.turn.endsAt + GRACE_MS) return endTurn(s, now);
  return [];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, isFinite(n) ? n : lo));

// ---------- per-device projection (anti-cheat lives here) ----------

export function roleOf(s: RoomState, viewerId: string | null): Role {
  if (viewerId === null) return 'display';
  const p = s.players.find((x) => x.id === viewerId);
  if (!p || !p.teamId) return 'spectator';
  if (!s.turn) return 'guesser';
  if (s.turn.describerId === p.id) return 'describer';
  return p.teamId === s.turn.teamId ? 'guesser' : 'judge';
}

export function projectView(s: RoomState, viewerId: string | null): RoomView {
  const role = roleOf(s, viewerId);
  let turn: TurnView | null = null;
  if (s.turn) {
    const t = s.turn;
    const live = s.phase === 'turn-live';
    const canSee = live && (role === 'describer' || role === 'judge') && t.cursor < t.cards.length;
    turn = {
      number: t.number,
      teamId: t.teamId,
      describerId: t.describerId,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      total: s.phase === 'turn-ready' ? s.settings.wordsPerTurn : t.cards.length,
      cursor: t.cursor,
      outcomes: t.log.map((e) => e.outcome),
      streak: t.streak,
      points: turnPoints(s, t).points,
      card: canSee ? t.cards[t.cursor] : null,
      revealed: s.phase === 'turn-review' ? t.log : null,
    };
  }
  return {
    code: s.code,
    phase: s.phase,
    hostId: effectiveHost(s),
    players: s.players,
    teams: s.teams,
    settings: s.settings,
    turn,
    turnsPerTeam: s.turnsPerTeam,
    totalTurns: s.turnsPerTeam * s.teams.length,
    turnsPlayed: turnsPlayed(s),
    matchNumber: s.matchNumber,
    roomWordCount: s.roomWords.length,
    myRoomWords: viewerId ? s.roomWords.filter((w) => w.by === viewerId).map((w) => w.word) : [],
    customDeckName: s.customDeck?.name ?? null,
    customDeckSize: s.customDeck?.words.length ?? 0,
    stats: s.stats,
    me: { id: viewerId, role },
    canStart: canStart(s),
  };
}
