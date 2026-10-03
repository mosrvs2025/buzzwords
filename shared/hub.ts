/**
 * RoomHub: the authoritative multiplayer layer (seats, tokens, fan-out, rate
 * limits, timers). Transport- and platform-agnostic, so the exact same code
 * runs on the Node server *and* inside a host's browser tab (peer mode).
 */
import { addPlayer, applyAction, createRoom, GameError, projectView, removePlayer, tick } from './engine';
import { sanitizeLook } from './looks';
import type { Action, ClientMsg, GameEvent, RoomState, ServerMsg } from './types';

export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'; // consonants only: no accidental words, no I/O/0 confusion
const LOBBY_DROP_MS = 5 * 60_000;
const ROOM_TTL_MS = 12 * 60 * 60_000;

/** One connected device, whatever the wire is (WebSocket, WebRTC data channel, in-tab loopback). */
export interface Link {
  send(msg: ServerMsg): void;
  close(): void;
}

interface Conn {
  link: Link;
  room: RoomRecord | null;
  playerId: string | null; // null = shared display
  bucket: number;
  lastRefill: number;
  lastReact: number;
  speaking: boolean;
}

export interface RoomRecord {
  state: RoomState;
  tokens: Record<string, string>;
  conns: Set<Conn>;
}

export interface Snapshot {
  state: RoomState;
  tokens: Record<string, string>;
}

function randU32() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}
export const rng = () => randU32() / 2 ** 32;
const randInt = (n: number) => Math.floor(rng() * n);
const hex = (bytes: number) => {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export function newCode(): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[randInt(CODE_ALPHABET.length)]).join('');
}

export class RoomHub {
  rooms = new Map<string, RoomRecord>();
  dirty = false;
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(opts: { autoTick?: boolean } = {}) {
    if (opts.autoTick !== false) {
      this.timers.push(setInterval(() => this.tickAll(), 200), setInterval(() => this.sweep(), 30_000));
      for (const t of this.timers) (t as { unref?: () => void }).unref?.();
    }
  }

  stop() {
    this.timers.forEach(clearInterval);
  }

  restore(snaps: Snapshot[]) {
    for (const r of snaps) {
      for (const p of r.state.players) {
        p.connected = false;
        p.voice = 'off';
        p.look ??= sanitizeLook(null);
      }
      this.rooms.set(r.state.code, { state: r.state, tokens: r.tokens, conns: new Set() });
    }
  }

  snapshot(code?: string): Snapshot[] {
    return [...this.rooms.values()].filter((r) => !code || r.state.code === code).map((r) => ({ state: r.state, tokens: r.tokens }));
  }

  createRoom(code?: string): string {
    let c = code ?? '';
    while (!c || this.rooms.has(c)) c = newCode();
    this.rooms.set(c, { state: createRoom(c, Date.now()), tokens: {}, conns: new Set() });
    this.dirty = true;
    return c;
  }

  has(code: string) {
    return this.rooms.has(code.toUpperCase());
  }

  /** Register a new device link; returns handlers for its incoming messages and its closing. */
  connect(link: Link) {
    const conn: Conn = { link, room: null, playerId: null, bucket: 30, lastRefill: Date.now(), lastReact: 0, speaking: false };
    return {
      message: (msg: ClientMsg) => this.onMessage(conn, msg),
      close: () => this.onClose(conn),
    };
  }

  private onMessage(conn: Conn, msg: ClientMsg) {
    // token bucket: 20 msg/s sustained, bursts of 30
    const now = Date.now();
    conn.bucket = Math.min(30, conn.bucket + ((now - conn.lastRefill) / 1000) * 20);
    conn.lastRefill = now;
    if (conn.bucket < 1) return;
    conn.bucket--;
    if (!msg || typeof msg !== 'object') return;

    const room = conn.room;
    if (msg.t === 'ping') return conn.link.send({ t: 'pong', c: msg.c, s: Date.now() });
    if (msg.t === 'hello') {
      if (room) return;
      const r = this.rooms.get(String(msg.room).toUpperCase());
      if (!r) return conn.link.send({ t: 'error', message: 'Room not found', fatal: true });
      try {
        this.hello(r, conn, msg);
      } catch (e) {
        conn.room = null;
        conn.link.send({ t: 'error', message: e instanceof GameError ? e.message : 'Could not join', fatal: true });
      }
      return;
    }
    if (!room || !conn.playerId) return;
    if (msg.t === 'rtc') {
      // signaling only flows between players who both opted into voice
      const me = room.state.players.find((p) => p.id === conn.playerId);
      const them = room.state.players.find((p) => p.id === msg.to);
      if (!me || !them || me.voice === 'off' || them.voice === 'off') return;
      if (JSON.stringify(msg.data).length > 32_000) return;
      for (const c of room.conns) if (c.playerId === msg.to) c.link.send({ t: 'rtc', from: conn.playerId, data: msg.data });
      return;
    }
    if (msg.t === 'speak') {
      const on = !!msg.on;
      if (conn.speaking === on) return;
      conn.speaking = on;
      for (const c of room.conns) c.link.send({ t: 'speak', id: conn.playerId, on });
      return;
    }
    if (msg.t === 'action') {
      if (msg.action?.type === 'react') {
        if (now - conn.lastReact < 250) return;
        conn.lastReact = now;
      }
      this.act(room, conn, msg.action);
    }
  }

  private onClose(conn: Conn) {
    const room = conn.room;
    if (!room) return;
    room.conns.delete(conn);
    if (!conn.playerId) return;
    if (conn.speaking) for (const c of room.conns) c.link.send({ t: 'speak', id: conn.playerId, on: false });
    const p = room.state.players.find((x) => x.id === conn.playerId);
    const stillHere = [...room.conns].some((c) => c.playerId === conn.playerId);
    if (p && !stillHere) {
      p.connected = false;
      p.voice = 'off';
      p.lastSeenAt = Date.now();
      this.broadcast(room);
    }
  }

  private hello(r: RoomRecord, conn: Conn, msg: Extract<ClientMsg, { t: 'hello' }>) {
    const s = r.state;
    const now = Date.now();
    conn.room = r;
    if (msg.display) {
      conn.playerId = null;
    } else if (msg.playerId && msg.token && r.tokens[msg.playerId] === msg.token && s.players.some((p) => p.id === msg.playerId)) {
      // reconnect: same seat, same team, same everything
      conn.playerId = msg.playerId;
      const p = s.players.find((x) => x.id === msg.playerId)!;
      p.connected = true;
      p.lastSeenAt = now;
    } else if (msg.name) {
      const id = hex(6);
      const token = hex(16);
      const p = addPlayer(s, { id, name: msg.name, look: msg.look }, now);
      r.tokens[id] = token;
      conn.playerId = id;
      conn.link.send({ t: 'welcome', playerId: id, token });
      r.conns.add(conn);
      this.emit(r, [{ kind: 'join', name: p.name }]);
      this.broadcast(r);
      return;
    } else {
      // stale identity (e.g. kicked or room was reset): ask the client to pick a name
      conn.link.send({ t: 'welcome', playerId: null, token: null });
      throw new GameError('Pick a name to join');
    }
    conn.link.send({ t: 'welcome', playerId: conn.playerId, token: conn.playerId ? r.tokens[conn.playerId] : null });
    r.conns.add(conn);
    this.broadcast(r);
  }

  private act(r: RoomRecord, conn: Conn, action: Action) {
    try {
      const kickedId = action.type === 'kick' ? action.playerId : null;
      const events = applyAction(r.state, conn.playerId!, action, Date.now(), rng);
      if (kickedId && !r.state.players.some((p) => p.id === kickedId)) {
        delete r.tokens[kickedId];
        for (const c of r.conns)
          if (c.playerId === kickedId) {
            c.link.send({ t: 'error', message: 'You were removed from the room', fatal: true });
            c.link.close();
          }
      }
      this.emit(r, events);
      if (action.type !== 'react') this.broadcast(r);
    } catch (e) {
      if (e instanceof GameError) conn.link.send({ t: 'error', message: e.message });
      else console.error(e);
    }
  }

  private emit(r: RoomRecord, events: GameEvent[]) {
    const now = Date.now();
    for (const ev of events) for (const c of r.conns) c.link.send({ t: 'event', ev, now });
  }

  broadcast(r: RoomRecord) {
    const now = Date.now();
    r.state.updatedAt = now;
    r.state.seq++;
    this.dirty = true;
    for (const c of r.conns) c.link.send({ t: 'state', view: projectView(r.state, c.playerId), now });
  }

  tickAll() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      const events = tick(r.state, now);
      if (events.length) {
        this.emit(r, events);
        this.broadcast(r);
      }
    }
  }

  sweep() {
    const now = Date.now();
    for (const [code, r] of this.rooms) {
      if (!r.conns.size && now - r.state.updatedAt > ROOM_TTL_MS) {
        this.rooms.delete(code);
        this.dirty = true;
        continue;
      }
      // people who wandered off in the lobby free their seat after a while
      if (r.state.phase === 'lobby') {
        const gone = r.state.players.filter((p) => !p.connected && now - p.lastSeenAt > LOBBY_DROP_MS);
        for (const p of gone) {
          removePlayer(r.state, p.id, now, rng);
          delete r.tokens[p.id];
        }
        if (gone.length) this.broadcast(r);
      }
    }
  }
}
