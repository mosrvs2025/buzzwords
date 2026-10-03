import { randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import {
  addPlayer, applyAction, createRoom, GameError, projectView, removePlayer, tick,
} from '../shared/engine';
import { sanitizeLook } from '../shared/looks';
import type { Action, ClientMsg, GameEvent, RoomState, ServerMsg } from '../shared/types';

const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'; // consonants only: no accidental words, no I/O/0 confusion
const LOBBY_DROP_MS = 5 * 60_000;
const ROOM_TTL_MS = 12 * 60 * 60_000;

interface Conn {
  ws: WebSocket;
  playerId: string | null; // null = shared display
  bucket: number;
  lastRefill: number;
  lastReact: number;
  speaking: boolean;
}

interface RoomRecord {
  state: RoomState;
  tokens: Record<string, string>;
  conns: Set<Conn>;
}

const rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export class RoomManager {
  rooms = new Map<string, RoomRecord>();
  private dirty = false;

  constructor(private dataFile: string | null) {
    this.load();
    setInterval(() => this.tickAll(), 200).unref();
    setInterval(() => this.flush(), 2000).unref();
    setInterval(() => this.sweep(), 30_000).unref();
  }

  // ----- persistence: a JSON snapshot is plenty for party-scale rooms and survives restarts/deploys -----

  private load() {
    if (!this.dataFile || !fs.existsSync(this.dataFile)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.dataFile, 'utf8')) as { state: RoomState; tokens: Record<string, string> }[];
      for (const r of raw) {
        for (const p of r.state.players) {
          p.connected = false;
          p.voice = 'off';
          p.look ??= sanitizeLook(null); // snapshots from before avatars v2
        }
        this.rooms.set(r.state.code, { state: r.state, tokens: r.tokens, conns: new Set() });
      }
      console.log(`[rooms] restored ${raw.length} room(s)`);
    } catch (e) {
      console.warn('[rooms] could not restore snapshot', e);
    }
  }

  flush() {
    if (!this.dataFile || !this.dirty) return;
    this.dirty = false;
    const data = [...this.rooms.values()].map((r) => ({ state: r.state, tokens: r.tokens }));
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = this.dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, this.dataFile);
  }

  createRoom(): string {
    let code = '';
    do {
      code = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    this.rooms.set(code, { state: createRoom(code, Date.now()), tokens: {}, conns: new Set() });
    this.dirty = true;
    return code;
  }

  has(code: string) {
    return this.rooms.has(code.toUpperCase());
  }

  // ----- sockets -----

  attach(ws: WebSocket) {
    let room: RoomRecord | null = null;
    const conn: Conn = { ws, playerId: null, bucket: 30, lastRefill: Date.now(), lastReact: 0, speaking: false };

    ws.on('message', (buf) => {
      // token bucket: 20 msg/s sustained, bursts of 30
      const now = Date.now();
      conn.bucket = Math.min(30, conn.bucket + ((now - conn.lastRefill) / 1000) * 20);
      conn.lastRefill = now;
      if (conn.bucket < 1) return;
      conn.bucket--;

      let msg: ClientMsg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (msg.t === 'ping') return send(ws, { t: 'pong', c: msg.c, s: Date.now() });
      if (msg.t === 'hello') {
        if (room) return;
        const r = this.rooms.get(String(msg.room).toUpperCase());
        if (!r) return send(ws, { t: 'error', message: 'Room not found', fatal: true });
        room = r;
        try {
          this.hello(r, conn, msg);
        } catch (e) {
          room = null;
          return send(ws, { t: 'error', message: e instanceof GameError ? e.message : 'Could not join', fatal: true });
        }
        return;
      }
      if (msg.t === 'rtc' && room && conn.playerId) {
        // signaling only flows between players who both opted into voice
        const me = room.state.players.find((p) => p.id === conn.playerId);
        const them = room.state.players.find((p) => p.id === msg.to);
        if (!me || !them || me.voice === 'off' || them.voice === 'off') return;
        const data = JSON.stringify({ t: 'rtc', from: conn.playerId, data: msg.data });
        if (data.length > 32_000) return;
        for (const c of room.conns) if (c.playerId === msg.to && c.ws.readyState === 1) c.ws.send(data);
        return;
      }
      if (msg.t === 'speak' && room && conn.playerId) {
        const on = !!msg.on;
        if (conn.speaking === on) return;
        conn.speaking = on;
        for (const c of room.conns) send(c.ws, { t: 'speak', id: conn.playerId, on });
        return;
      }
      if (msg.t === 'action' && room && conn.playerId) {
        if (msg.action?.type === 'react') {
          if (now - conn.lastReact < 250) return;
          conn.lastReact = now;
        }
        this.act(room, conn, msg.action);
      }
    });

    ws.on('close', () => {
      if (!room) return;
      room.conns.delete(conn);
      if (conn.playerId) {
        const p = room.state.players.find((x) => x.id === conn.playerId);
        const stillHere = [...room.conns].some((c) => c.playerId === conn.playerId);
        if (conn.speaking) for (const c of room.conns) send(c.ws, { t: 'speak', id: conn.playerId, on: false });
        if (p && !stillHere) {
          p.connected = false;
          p.voice = 'off';
          p.lastSeenAt = Date.now();
          this.broadcast(room);
        }
      }
    });
  }

  private hello(r: RoomRecord, conn: Conn, msg: Extract<ClientMsg, { t: 'hello' }>) {
    const s = r.state;
    const now = Date.now();
    if (msg.display) {
      conn.playerId = null;
    } else if (msg.playerId && msg.token && r.tokens[msg.playerId] === msg.token && s.players.some((p) => p.id === msg.playerId)) {
      // reconnect: same seat, same team, same everything
      conn.playerId = msg.playerId;
      const p = s.players.find((x) => x.id === msg.playerId)!;
      p.connected = true;
      p.lastSeenAt = now;
    } else if (msg.name) {
      const id = randomBytes(6).toString('hex');
      const token = randomBytes(16).toString('hex');
      const p = addPlayer(s, { id, name: msg.name, look: msg.look }, now);
      r.tokens[id] = token;
      conn.playerId = id;
      send(conn.ws, { t: 'welcome', playerId: id, token });
      r.conns.add(conn);
      this.emit(r, [{ kind: 'join', name: p.name }]);
      this.broadcast(r);
      return;
    } else {
      // stale identity (e.g. kicked or room was reset) — ask the client to pick a name
      send(conn.ws, { t: 'welcome', playerId: null, token: null });
      throw new GameError('Pick a name to join');
    }
    send(conn.ws, { t: 'welcome', playerId: conn.playerId, token: conn.playerId ? r.tokens[conn.playerId] : null });
    r.conns.add(conn);
    this.broadcast(r);
  }

  private act(r: RoomRecord, conn: Conn, action: Action) {
    try {
      const kickedId = action.type === 'kick' ? action.playerId : null;
      const events = applyAction(r.state, conn.playerId!, action, Date.now(), rng);
      if (kickedId && !r.state.players.some((p) => p.id === kickedId)) {
        delete r.tokens[kickedId];
        for (const c of r.conns) if (c.playerId === kickedId) {
          send(c.ws, { t: 'error', message: 'You were removed from the room', fatal: true });
          c.ws.close();
        }
      }
      this.emit(r, events);
      if (action.type !== 'react') this.broadcast(r);
    } catch (e) {
      if (e instanceof GameError) send(conn.ws, { t: 'error', message: e.message });
      else console.error(e);
    }
  }

  private emit(r: RoomRecord, events: GameEvent[]) {
    const now = Date.now();
    for (const ev of events) for (const c of r.conns) send(c.ws, { t: 'event', ev, now });
  }

  broadcast(r: RoomRecord) {
    const now = Date.now();
    r.state.updatedAt = now;
    r.state.seq++;
    this.dirty = true;
    for (const c of r.conns) send(c.ws, { t: 'state', view: projectView(r.state, c.playerId), now });
  }

  private tickAll() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      const events = tick(r.state, now);
      if (events.length) {
        this.emit(r, events);
        this.broadcast(r);
      }
    }
  }

  private sweep() {
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

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
