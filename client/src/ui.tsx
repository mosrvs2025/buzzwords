import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_STYLES } from '../../shared/style';
import type { GameEvent, Player, RoomView, Team, WordOutcome } from '../../shared/types';
import { Avatar, type Mood } from './Avatar';
import type { RoomConn } from './net';

export const teamStyle = (view: RoomView | null, teamId: string | null | undefined) => {
  const t = view?.teams.find((x) => x.id === teamId);
  return t ? TEAM_STYLES[t.style] : { name: '—', color: '#FFF7EA', deep: '#1D1A2B', soft: '#FFF7EA' };
};

export const playerById = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id);

export const membersOf = (view: RoomView, teamId: string) =>
  view.players.filter((p) => p.teamId === teamId).sort((a, b) => a.joinedAt - b.joinedAt);

export function PlayerChip({ view, p, mood, size = 44, extra }: { view: RoomView; p: Player; mood?: Mood; size?: number; extra?: React.ReactNode }) {
  const st = teamStyle(view, p.teamId);
  return (
    <div className={`chip ${p.connected ? '' : 'offline'}`}>
      <Avatar seed={p.avatar} color={st.color} size={size} mood={mood ?? (p.connected ? 'idle' : 'sleep')} />
      <span className="chip-name">
        {p.name}
        {p.id === view.me.id && <em> (you)</em>}
      </span>
      {extra}
    </div>
  );
}

// ---------- timer ----------

export function useCountdown(view: RoomView | null, now: number) {
  const t = view?.turn;
  if (!t || !t.startsAt || !t.endsAt) return { pre: 0, left: view?.settings.turnSeconds ?? 60, frac: 1, live: false };
  const total = (t.endsAt - t.startsAt) / 1000;
  const pre = Math.max(0, Math.ceil((t.startsAt - now) / 1000));
  const left = Math.max(0, (t.endsAt - Math.max(now, t.startsAt)) / 1000);
  return { pre, left, frac: left / total, live: view?.phase === 'turn-live' && now >= t.startsAt };
}

export function TimerRing({ frac, left, size = 120, color }: { frac: number; left: number; size?: number; color: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const urgent = left <= 10 && left > 0;
  return (
    <div className={`timer ${urgent ? 'urgent' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`${Math.ceil(left)} seconds left`}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r + 4} fill="#FFF7EA" stroke="#1D1A2B" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r={r - 6}
          fill="none"
          stroke={urgent ? '#FF4D2E' : color}
          strokeWidth="14"
          strokeDasharray={`${c * frac * ((r - 6) / r)} 999`}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      </svg>
      <span className="timer-num">{Math.ceil(left)}</span>
    </div>
  );
}

// ---------- word progress pips ----------

export function Pips({ total, outcomes, cursor }: { total: number; outcomes: WordOutcome[]; cursor: number }) {
  return (
    <div className="pips" aria-label={`${outcomes.filter((o) => o === 'correct').length} of ${total} correct`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`pip ${outcomes[i] ?? (i === cursor ? 'current' : '')}`} />
      ))}
    </div>
  );
}

// ---------- floating reactions / bursts ----------

interface Floater {
  id: number;
  text: string;
  x: number;
  kind: 'react' | 'burst' | 'foul';
}

export function FxLayer({ conn, view }: { conn: RoomConn; view: RoomView | null }) {
  const [items, setItems] = useState<Floater[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(
    () =>
      conn.onEvent((ev: GameEvent) => {
        let f: Floater | null = null;
        const id = Math.random();
        if (ev.kind === 'react') f = { id, text: ev.emoji, x: 10 + Math.random() * 80, kind: 'react' };
        if (ev.kind === 'correct') f = { id, text: ev.streak >= 3 ? `🔥×${ev.streak}` : '+1', x: 30 + Math.random() * 40, kind: 'burst' };
        if (ev.kind === 'foul') f = { id, text: 'BUZZ!', x: 50, kind: 'foul' };
        if (!f) return;
        const item = f;
        setItems((xs) => [...xs.slice(-24), item]);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 2200);
      }),
    [conn],
  );
  return (
    <div className="fx-layer" aria-hidden>
      {items.map((f) => (
        <span key={f.id} className={`floater ${f.kind}`} style={{ left: `${f.x}%` }}>
          {f.text}
        </span>
      ))}
    </div>
  );
}

export function Confetti({ colors, count = 90 }: { colors: string[]; count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 2.4 + Math.random() * 2,
        rot: Math.random() * 360,
        color: colors[i % colors.length],
        w: 8 + Math.random() * 10,
      })),
    [colors, count],
  );
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i
          key={i}
          style={{ left: `${b.left}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, background: b.color, width: b.w, height: b.w * 0.45, rotate: `${b.rot}deg` }}
        />
      ))}
    </div>
  );
}

// ---------- QR ----------

export function QR({ text, size = 180 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#1D1A2B', light: '#FFF7EA' }, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [text]);
  return <div className="qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} aria-label="QR code to join" />;
}

export const joinUrl = (code: string) => `${location.origin}/room/${code}`;

export function Toast({ toast }: { toast: { msg: string; id: number } | null }) {
  const [shown, setShown] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return shown ? (
    <div className="toast" role="status" key={shown.id}>
      {shown.msg}
    </div>
  ) : null;
}

export function ConnBanner({ status }: { status: RoomConn['status'] }) {
  if (status === 'open') return null;
  return (
    <div className="conn-banner" role="status">
      <span className="spinner" /> {status === 'connecting' ? 'Connecting…' : 'Reconnecting… hang tight, your seat is saved'}
    </div>
  );
}

export function standings(teams: Team[]) {
  return [...teams].sort((a, b) => b.score - a.score);
}
