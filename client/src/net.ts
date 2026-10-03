import { useCallback, useEffect, useRef, useState } from 'react';
import { randomLook, sanitizeLook, type Look } from '../../shared/looks';
import type { Action, ClientMsg, GameEvent, RoomView, ServerMsg } from '../../shared/types';
import { hostingRuntime } from './host';
import { detectMode, peerTransport, wsTransport, type Mode, type Transport } from './transport';

export type Status = 'connecting' | 'open' | 'reconnecting';

interface Identity {
  playerId: string;
  token: string;
}

const idKey = (code: string) => `bw:id:${code}`;
export const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

export interface Profile {
  name: string;
  look: Look;
}
export function getProfile(): Profile | null {
  const p = store.get<Partial<Profile>>('bw:profile');
  if (!p) return null;
  return { name: p.name ?? '', look: p.look ? sanitizeLook(p.look) : randomLook() };
}
export const setProfile = (p: Profile) => store.set('bw:profile', p);

/** Local progress drives cosmetic unlocks until accounts exist. */
export interface Progress {
  games: number;
  wins: number;
  lastMatch?: string;
}
export const getProgress = (): Progress => store.get<Progress>('bw:progress') ?? { games: 0, wins: 0 };
export function recordMatch(key: string, won: boolean): Progress {
  const p = getProgress();
  if (p.lastMatch === key) return p; // reconnects re-deliver nothing, but be safe
  const next = { games: p.games + 1, wins: p.wins + (won ? 1 : 0), lastMatch: key };
  store.set('bw:progress', next);
  return next;
}

type Listener = (ev: GameEvent) => void;
type RtcListener = (from: string, data: unknown) => void;

/**
 * One socket per screen. Owns reconnects, identity (seat token per room),
 * and a server-clock offset so every device's timer agrees.
 */
export function useRoom(code: string, opts: { display?: boolean } = {}) {
  const [status, setStatus] = useState<Status>('connecting');
  const [view, setView] = useState<RoomView | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const ws = useRef<Transport | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [isHostDevice, setIsHostDevice] = useState(false);
  const listeners = useRef(new Set<Listener>());
  const rtcListeners = useRef(new Set<RtcListener>());
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());
  const offset = useRef(0);
  const bestRtt = useRef(Infinity);
  const pendingJoin = useRef<Profile | null>(null);
  const closedForGood = useRef(false);

  const raw = useCallback((m: ClientMsg) => {
    if (ws.current?.isOpen()) ws.current.send(m);
  }, []);

  const hello = useCallback(() => {
    const id = store.get<Identity>(idKey(code));
    if (opts.display) return raw({ t: 'hello', room: code, display: true });
    if (id) return raw({ t: 'hello', room: code, playerId: id.playerId, token: id.token });
    if (pendingJoin.current) return raw({ t: 'hello', room: code, ...pendingJoin.current });
    setNeedsName(true);
  }, [code, opts.display, raw]);

  useEffect(() => {
    closedForGood.current = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout>;
    let pinger: ReturnType<typeof setInterval>;

    let unavailable = 0;
    let everOpen = false;
    const connect = async () => {
      clearTimeout(retry);
      if (closedForGood.current) return;
      const m0 = await detectMode();
      if (closedForGood.current) return;
      setMode(m0);
      const rt = m0 === 'peer' ? hostingRuntime(code) : null;
      setIsHostDevice(!!rt);
      let t: Transport;
      const onMessage = (m: ServerMsg) => {
        if (m.t === 'pong') {
          const now = Date.now();
          const rtt = now - m.c;
          // keep the sample with the tightest round-trip; it has the least error
          if (rtt <= bestRtt.current * 1.5) {
            bestRtt.current = Math.min(bestRtt.current, rtt);
            offset.current = m.s - (m.c + rtt / 2);
          }
        } else if (m.t === 'welcome') {
          if (m.playerId && m.token) {
            store.set(idKey(code), { playerId: m.playerId, token: m.token });
            setNeedsName(false);
          } else {
            store.set(idKey(code), null);
            setNeedsName(true);
          }
        } else if (m.t === 'state') {
          setView(m.view);
          setNeedsName(false);
        } else if (m.t === 'rtc') {
          rtcListeners.current.forEach((l) => l(m.from, m.data));
        } else if (m.t === 'speak') {
          setSpeaking((prev) => {
            if (prev.has(m.id) === m.on) return prev;
            const next = new Set(prev);
            if (m.on) next.add(m.id);
            else next.delete(m.id);
            return next;
          });
        } else if (m.t === 'event') {
          listeners.current.forEach((l) => l(m.ev));
        } else if (m.t === 'error') {
          if (m.fatal && m.message !== 'Pick a name to join') {
            setFatal(m.message);
            closedForGood.current = true;
            t.close();
          } else if (!m.fatal) setToast({ msg: m.message, id: Date.now() });
        }
      };
      const handlers = {
        onOpen: () => {
          attempt = 0;
          unavailable = 0;
          everOpen = true;
          setStatus('open');
          bestRtt.current = Infinity;
          hello();
          const ping = () => raw({ t: 'ping', c: Date.now() });
          ping();
          clearInterval(pinger);
          pinger = setInterval(ping, 4000);
        },
        onMessage,
        onClose: (info?: { fatal?: string }) => {
          clearInterval(pinger);
          if (ws.current !== t || closedForGood.current) return;
          if (info?.fatal === 'unavailable' && ++unavailable >= (everOpen ? 40 : 3)) {
            setFatal(everOpen ? 'The host left — this room has ended.' : 'Room not found. Double-check the code — and make sure the host still has the game open.');
            closedForGood.current = true;
            return;
          }
          setStatus('reconnecting');
          setSpeaking(new Set());
          attempt++;
          retry = setTimeout(connect, Math.min(4000, 300 * 2 ** attempt));
        },
      };
      t = rt ? rt.loopback(handlers) : m0 === 'server' ? wsTransport(handlers) : peerTransport(code, handlers);
      ws.current = t;
    };

    // phones sleep sockets aggressively — wake up fast when the tab comes back
    const wake = () => {
      if (document.visibilityState === 'visible' && ws.current && !ws.current.isOpen()) {
        ws.current.close();
        void connect();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    void connect();
    return () => {
      closedForGood.current = true;
      clearTimeout(retry);
      clearInterval(pinger);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      ws.current?.close();
    };
  }, [code, hello, raw]);

  const send = useCallback((action: Action) => raw({ t: 'action', action }), [raw]);
  const join = useCallback(
    (p: Profile) => {
      pendingJoin.current = p;
      setProfile(p);
      raw({ t: 'hello', room: code, ...p });
    },
    [code, raw],
  );
  const onEvent = useCallback((l: Listener) => {
    listeners.current.add(l);
    return () => void listeners.current.delete(l);
  }, []);
  const onRtc = useCallback((l: RtcListener) => {
    rtcListeners.current.add(l);
    return () => void rtcListeners.current.delete(l);
  }, []);
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const leave = useCallback(() => store.set(idKey(code), null), [code]);

  return { mode, isHostDevice, status, view, needsName, fatal, toast, send, raw, join, onEvent, onRtc, speaking, serverNow, leave };
}

export type RoomConn = ReturnType<typeof useRoom>;

/** re-render on an interval (for timers) */
export function useNow(serverNow: () => number, ms = 100) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(t);
  }, [serverNow, ms]);
  return now;
}
