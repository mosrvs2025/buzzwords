import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, ClientMsg, GameEvent, RoomView, ServerMsg } from '../../shared/types';

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
  avatar: number;
}
export const getProfile = () => store.get<Profile>('bw:profile');
export const setProfile = (p: Profile) => store.set('bw:profile', p);

type Listener = (ev: GameEvent) => void;

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
  const ws = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<Listener>());
  const offset = useRef(0);
  const bestRtt = useRef(Infinity);
  const pendingJoin = useRef<Profile | null>(null);
  const closedForGood = useRef(false);

  const raw = useCallback((m: ClientMsg) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m));
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

    const connect = () => {
      clearTimeout(retry);
      if (closedForGood.current) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const sock = new WebSocket(`${proto}://${location.host}/ws`);
      ws.current = sock;
      sock.onopen = () => {
        attempt = 0;
        setStatus('open');
        bestRtt.current = Infinity;
        hello();
        const ping = () => raw({ t: 'ping', c: Date.now() });
        ping();
        clearInterval(pinger);
        pinger = setInterval(ping, 4000);
      };
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data) as ServerMsg;
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
        } else if (m.t === 'event') {
          listeners.current.forEach((l) => l(m.ev));
        } else if (m.t === 'error') {
          if (m.fatal && m.message !== 'Pick a name to join') {
            setFatal(m.message);
            closedForGood.current = true;
            sock.close();
          } else if (!m.fatal) setToast({ msg: m.message, id: Date.now() });
        }
      };
      sock.onclose = () => {
        clearInterval(pinger);
        if (ws.current !== sock || closedForGood.current) return;
        setStatus('reconnecting');
        attempt++;
        retry = setTimeout(connect, Math.min(4000, 300 * 2 ** attempt));
      };
    };

    // phones sleep sockets aggressively — wake up fast when the tab comes back
    const wake = () => {
      if (document.visibilityState === 'visible' && ws.current?.readyState !== WebSocket.OPEN) {
        ws.current?.close();
        connect();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    connect();
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
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  const leave = useCallback(() => store.set(idKey(code), null), [code]);

  return { status, view, needsName, fatal, toast, send, join, onEvent, serverNow, leave };
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
