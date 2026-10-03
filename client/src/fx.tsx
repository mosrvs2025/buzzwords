import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LOOK } from '../../shared/looks';
import type { GameEvent, RoomView } from '../../shared/types';
import { Avatar } from './Avatar';
import type { RoomConn } from './net';
import { playerById, teamStyle } from './ui';

/** Numbers that tick up/down instead of snapping — scores feel earned. */
export function AnimatedNumber({ value, prefixPlus = false, className = '', from: start0 }: { value: number; prefixPlus?: boolean; className?: string; from?: number }) {
  const [shown, setShown] = useState(start0 ?? value);
  const from = useRef(start0 ?? value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const dur = Math.min(900, 120 + Math.abs(value - a) * 70);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return (
    <span className={`anum ${className}`} key={value}>
      {prefixPlus && shown > 0 ? `+${shown}` : shown}
    </span>
  );
}

/** A radial particle pop. Re-trigger by changing `id`. */
export function Burst({ id, colors, count = 16, spread = 140 }: { id: number | string; colors: string[]; count?: number; spread?: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = spread * (0.55 + Math.random() * 0.6);
        return {
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist,
          c: colors[i % colors.length],
          s: 8 + Math.random() * 10,
          r: Math.random() * 360,
          round: i % 3 === 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  return (
    <span className="burst" key={id} aria-hidden>
      {parts.map((p, i) => (
        <i
          key={i}
          style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, background: p.c, width: p.s, height: p.round ? p.s : p.s * 0.5, borderRadius: p.round ? '50%' : 2 } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

type Overlay =
  | { kind: 'intro'; teamId: string; describerId: string; id: number }
  | { kind: 'time'; points: number; sweep: boolean; teamId: string; id: number }
  | { kind: 'fire'; streak: number; teamId: string; id: number }
  | { kind: 'buzz'; id: number };

/**
 * Big full-screen moments: turn intro, time's up, streak milestones, fouls.
 * Shared by phones and the TV so the whole room feels the beat together.
 */
export function Moments({ conn, view, big = false }: { conn: RoomConn; view: RoomView; big?: boolean }) {
  const [o, setO] = useState<Overlay | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const show = (x: Overlay, ms: number) => {
      setO(x);
      clearTimeout(t);
      t = setTimeout(() => setO((cur) => (cur?.id === x.id ? null : cur)), ms);
    };
    const off = conn.onEvent((ev: GameEvent) => {
      const id = Math.random();
      if (ev.kind === 'turn-start') show({ kind: 'intro', teamId: ev.teamId, describerId: ev.describerId, id }, 2100);
      if (ev.kind === 'turn-end') show({ kind: 'time', points: ev.points, sweep: ev.sweep, teamId: ev.teamId, id }, 1700);
      if (ev.kind === 'correct' && (ev.streak === 3 || ev.streak === 5 || ev.streak === 7 || ev.streak === 10)) show({ kind: 'fire', streak: ev.streak, teamId: ev.teamId, id }, 1300);
      if (ev.kind === 'foul') show({ kind: 'buzz', id }, 1100);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [conn]);

  // the describer is mid-word: don't cover their card with anything but the briefest flash
  const describerLive = view.phase === 'turn-live' && view.me.role === 'describer';
  if (!o) return null;
  if (describerLive && o.kind !== 'fire' && o.kind !== 'buzz') return null;

  if (o.kind === 'intro') {
    const st = teamStyle(view, o.teamId);
    const d = playerById(view, o.describerId);
    const mine = view.me.id === o.describerId;
    return (
      <div className={`moment intro ${big ? 'big' : ''}`} style={{ '--team': st.color, '--team-deep': st.deep } as React.CSSProperties} aria-live="polite">
        <div className="intro-band">
          <span className="intro-team">TEAM {st.name.toUpperCase()}</span>
        </div>
        <div className="intro-hero">
          <Avatar look={d?.look ?? DEFAULT_LOOK} ring={st.color} size={big ? 300 : 170} mood="happy" />
          <div className="intro-name">{mine ? 'YOU’RE UP!' : `${d?.name ?? '…'} is up!`}</div>
        </div>
      </div>
    );
  }
  if (o.kind === 'time') {
    const st = teamStyle(view, o.teamId);
    return (
      <div className={`moment time ${big ? 'big' : ''}`} style={{ '--team': st.color } as React.CSSProperties} aria-live="polite">
        <div className="time-word">{o.sweep ? 'CLEAN SWEEP!' : 'TIME!'}</div>
        <div className="time-points">
          <AnimatedNumber value={o.points} prefixPlus />
        </div>
        {o.sweep && <Burst id={o.id} colors={[st.color, '#FFC22E', '#FFF7EA', '#2FBF55']} count={36} spread={big ? 520 : 240} />}
      </div>
    );
  }
  if (o.kind === 'fire') {
    return (
      <div className={`moment fire ${big ? 'big' : ''}`} aria-live="polite">
        <div className="fire-text">
          🔥 {o.streak >= 10 ? 'UNSTOPPABLE' : o.streak >= 7 ? 'INFERNO' : o.streak >= 5 ? 'BLAZING' : 'ON FIRE'} ×{o.streak}
        </div>
      </div>
    );
  }
  return (
    <div className={`moment buzz ${big ? 'big' : ''}`} aria-live="polite">
      <div className="buzz-text">BZZZT!</div>
    </div>
  );
}
