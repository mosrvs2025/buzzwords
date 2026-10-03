import type { ClientMsg, ServerMsg } from '../../shared/types';

/**
 * Two ways to reach a room:
 *  - "server": a dedicated Node game server over WebSockets (best: survives the host leaving).
 *  - "peer":   no server available (e.g. a static Vercel deploy). The host's browser runs the
 *              same RoomHub and everyone else connects to it peer-to-peer over WebRTC.
 * The mode is detected once per page load.
 */
export type Mode = 'server' | 'peer';

const SERVER = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '');
export const apiBase = SERVER; // '' = same origin

let modePromise: Promise<Mode> | null = null;
export function detectMode(): Promise<Mode> {
  const forced = new URLSearchParams(location.search).get('mode') ?? (import.meta.env.VITE_MODE as string | undefined);
  if (forced === 'peer' || forced === 'server') return Promise.resolve(forced);
  modePromise ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 3000);
      const res = await fetch(`${apiBase}/api/health`, { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(t);
      const body = await res.json();
      return body?.ok && typeof body.rooms === 'number' ? 'server' : 'peer';
    } catch {
      return 'peer';
    }
  })();
  return modePromise;
}

export interface Handlers {
  onOpen(): void;
  onMessage(m: ServerMsg): void;
  /** fatal = don't bother retrying */
  onClose(info?: { fatal?: string }): void;
}

export interface Transport {
  send(m: ClientMsg): void;
  isOpen(): boolean;
  close(): void;
}

export function wsTransport(h: Handlers): Transport {
  const base = SERVER ? SERVER.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  const sock = new WebSocket(`${base}/ws`);
  let closed = false;
  sock.onopen = () => h.onOpen();
  sock.onmessage = (e) => h.onMessage(JSON.parse(e.data));
  sock.onclose = () => {
    if (!closed) h.onClose();
    closed = true;
  };
  return {
    send: (m) => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify(m)),
    isOpen: () => sock.readyState === WebSocket.OPEN,
    close: () => {
      closed = true;
      sock.close();
    },
  };
}

// ---------- PeerJS (peer mode) ----------

export const peerIdFor = (code: string) => `buzzwords-v1-${code.toUpperCase()}`;

export function peerOptions() {
  const env = import.meta.env;
  const iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (env.VITE_TURN_URL) iceServers.push({ urls: String(env.VITE_TURN_URL).split(','), username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL });
  const o: Record<string, unknown> = { config: { iceServers }, debug: 1 };
  if (env.VITE_PEER_HOST) {
    o.host = env.VITE_PEER_HOST;
    o.port = Number(env.VITE_PEER_PORT || 443);
    o.path = env.VITE_PEER_PATH || '/';
    o.secure = env.VITE_PEER_SECURE ? env.VITE_PEER_SECURE === 'true' : o.port === 443;
  }
  return o;
}

export async function loadPeer() {
  return (await import('peerjs')).Peer;
}

/** Guest side: connect to the host's tab for this room code. */
export function peerTransport(code: string, h: Handlers): Transport {
  let open = false;
  let done = false;
  let peer: import('peerjs').Peer | null = null;
  let dc: import('peerjs').DataConnection | null = null;
  const finish = (info?: { fatal?: string }) => {
    if (done) return;
    done = true;
    open = false;
    h.onClose(info);
    setTimeout(() => peer?.destroy(), 0);
  };
  void (async () => {
    const Peer = await loadPeer();
    if (done) return;
    peer = new Peer(peerOptions());
    peer.on('open', () => {
      dc = peer!.connect(peerIdFor(code), { reliable: true, serialization: 'json' });
      dc.on('open', () => {
        open = true;
        h.onOpen();
      });
      dc.on('data', (d) => h.onMessage(d as ServerMsg));
      dc.on('close', () => finish());
      dc.on('error', () => finish());
    });
    peer.on('error', (e: { type?: string }) => finish(e.type === 'peer-unavailable' ? { fatal: 'unavailable' } : undefined));
    peer.on('disconnected', () => {
      if (!open) finish();
    });
    // a data channel that never opens (blocked network) shouldn't hang forever
    setTimeout(() => !open && finish(), 15_000);
  })();
  return {
    send: (m) => {
      if (open) dc?.send(m);
    },
    isOpen: () => open,
    close: () => {
      done = true;
      peer?.destroy();
    },
  };
}
