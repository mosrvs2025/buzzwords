import type { DataConnection, Peer } from 'peerjs';
import { newCode, RoomHub, type Snapshot } from '../../shared/hub';
import type { ClientMsg, ServerMsg } from '../../shared/types';
import { store } from './net';
import { loadPeer, peerIdFor, peerOptions, type Handlers, type Transport } from './transport';

/**
 * Peer mode: this tab *is* the game server. It runs the shared RoomHub,
 * accepts WebRTC data connections from the other players' browsers, and
 * saves the room to localStorage so a host refresh doesn't end the game.
 */
const hostKey = (code: string) => `bw:host:${code}`;

class HostRuntime {
  hub = new RoomHub();
  peer: Peer | null = null;
  status: 'starting' | 'online' | 'error' = 'starting';
  ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;
  private saveTimer: ReturnType<typeof setInterval>;
  private wake: WakeLockSentinel | null = null;
  private retries: number;

  constructor(public code: string, snap: Snapshot | null) {
    this.retries = snap ? 10 : 0;
    if (snap) this.hub.restore([snap]);
    else this.hub.createRoom(code);
    this.ready = new Promise((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });
    this.saveTimer = setInterval(() => this.save(), 1500);
    addEventListener('pagehide', () => this.save());
    void this.listen(0);
    void this.keepAwake();
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.keepAwake());
  }

  save() {
    if (!this.hub.dirty) return;
    this.hub.dirty = false;
    store.set(hostKey(this.code), this.hub.snapshot(this.code)[0] ?? null);
  }

  private async keepAwake() {
    // the host's screen sleeping would pause the whole room
    try {
      this.wake = await navigator.wakeLock?.request('screen');
    } catch {
      /* not supported / not visible */
    }
  }

  private async listen(attempt: number) {
    const PeerCtor = await loadPeer();
    const peer = new PeerCtor(peerIdFor(this.code), peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      this.status = 'online';
      this.resolveReady();
    });
    peer.on('connection', (dc: DataConnection) => this.accept(dc));
    peer.on('disconnected', () => {
      // lost the signaling server; existing data channels keep working, but new joins need it
      if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
    });
    peer.on('error', (e: { type?: string }) => {
      if (e.type === 'unavailable-id') {
        // our previous tab (refresh) may still hold the id for a few seconds — or the code is taken
        peer.destroy();
        if (attempt < this.retries) setTimeout(() => void this.listen(attempt + 1), 2500);
        else {
          this.status = 'error';
          this.rejectReady(new Error('taken'));
        }
      } else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') {
        if (this.status !== 'online') {
          this.status = 'error';
          this.rejectReady(new Error('network'));
        }
      }
    });
  }

  private accept(dc: DataConnection) {
    let h: ReturnType<RoomHub['connect']> | null = null;
    dc.on('open', () => {
      h = this.hub.connect({
        send: (m: ServerMsg) => {
          if (dc.open) void dc.send(m);
        },
        close: () => dc.close(),
      });
    });
    dc.on('data', (d) => h?.message(d as ClientMsg));
    dc.on('close', () => h?.close());
    dc.on('error', () => h?.close());
  }

  /** The host's own UI talks to the hub in-process. */
  loopback(hd: Handlers): Transport {
    let open = true;
    const h = this.hub.connect({
      send: (m) => open && queueMicrotask(() => open && hd.onMessage(m)),
      close: () => {
        open = false;
        hd.onClose();
      },
    });
    queueMicrotask(() => hd.onOpen());
    return {
      send: (m) => open && queueMicrotask(() => h.message(m)),
      isOpen: () => open,
      close: () => {
        if (!open) return;
        open = false;
        h.close();
      },
    };
  }

  destroy() {
    clearInterval(this.saveTimer);
    this.hub.stop();
    this.peer?.destroy();
    void this.wake?.release();
    store.set(hostKey(this.code), null);
  }
}

const runtimes = new Map<string, HostRuntime>();

/** Am I hosting this room from this device (now, or before a refresh)? */
export function hostingRuntime(code: string): HostRuntime | null {
  const live = runtimes.get(code);
  if (live) return live;
  const snap = store.get<Snapshot>(hostKey(code));
  if (!snap) return null;
  const rt = new HostRuntime(code, snap);
  runtimes.set(code, rt);
  return rt;
}

/** Create a brand-new peer-hosted room; resolves once other devices can reach it. */
export async function startHosting(): Promise<string> {
  for (let i = 0; i < 4; i++) {
    const code = newCode();
    const rt = new HostRuntime(code, null);
    runtimes.set(code, rt);
    rt.save();
    try {
      await rt.ready;
      return code;
    } catch (e) {
      rt.destroy();
      runtimes.delete(code);
      if ((e as Error).message !== 'taken') throw e;
    }
  }
  throw new Error('taken');
}

export function stopHosting(code: string) {
  runtimes.get(code)?.destroy();
  runtimes.delete(code);
}
