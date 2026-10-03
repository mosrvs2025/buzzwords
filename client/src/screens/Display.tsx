import { DEFAULT_LOOK } from '../../../shared/looks';
import { useEffect, useRef, useState } from 'react';
import { MODES } from '../../../shared/modes';
import { TEAM_STYLES } from '../../../shared/style';
import type { RoomView } from '../../../shared/types';
import { Avatar } from '../Avatar';
import { useNow, useRoom, type RoomConn } from '../net';
import { sfx, unlockAudio } from '../sfx';
import { ConnBanner, FxLayer, joinUrl, membersOf, Pips, playerById, QR, teamStyle, TimerRing, useCountdown } from '../ui';
import { Final, Review } from './Results';

/**
 * The shared screen (TV / laptop / projector). It connects as a "display"
 * and the server never sends it a secret word — not even in the payload.
 */
export function Display({ code }: { code: string }) {
  const conn = useRoom(code, { display: true });
  const { view, fatal } = conn;
  const [soundOn, setSoundOn] = useState(false);
  useDisplaySounds(conn, view, soundOn);

  if (fatal) return <main className="display center-page"><h1>{fatal}</h1></main>;
  if (!view) return <main className="display center-page"><ConnBanner status="connecting" /></main>;

  return (
    <main className={`display phase-${view.phase}`}>
      <div className="spotlights" aria-hidden />
      {!soundOn && (
        <button className="sound-gate" onClick={() => (unlockAudio(), setSoundOn(true), document.documentElement.requestFullscreen?.().catch(() => {}))}>
          🔊 Click for sound + fullscreen
        </button>
      )}
      {view.phase === 'lobby' && <DisplayLobby view={view} conn={conn} />}
      {(view.phase === 'turn-ready' || view.phase === 'turn-live') && <DisplayTurn view={view} conn={conn} />}
      {view.phase === 'turn-review' && (
        <div className="display-pane">
          <Review view={view} big />
          <Scoreboard view={view} />
        </div>
      )}
      {view.phase === 'final' && <Final view={view} big />}
      <FxLayer conn={conn} view={view} />
      <ConnBanner status={conn.status} />
    </main>
  );
}

function DisplayLobby({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const mode = MODES[view.settings.modeId];
  return (
    <div className="d-lobby">
      <section className="d-join">
        <div className="d-logo">BUZZWORDS</div>
        <p className="d-join-line">
          Join on your phone at <b>{location.host}</b>
        </p>
        <div className="room-code huge">
          {view.code.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.1}s` }}>
              {c}
            </span>
          ))}
        </div>
        <QR text={joinUrl(view.code)} size={220} />
        <p className="d-mode">
          <b>{mode.name}</b> · {mode.tagline} · {view.settings.turnSeconds}s turns
          {view.roomWordCount > 0 && <> · 🫙 {view.roomWordCount} secret jar words</>}
        </p>
      </section>
      <section className="d-teams">
        {view.teams.map((t) => {
          const st = TEAM_STYLES[t.style];
          const m = membersOf(view, t.id);
          return (
            <div key={t.id} className="d-team" style={{ '--team': st.color, '--team-deep': st.deep } as React.CSSProperties}>
              <h2>{st.name}</h2>
              <div className="d-team-members">
                {m.map((p) => (
                  <div key={p.id} className={`d-member pop-in ${conn.speaking.has(p.id) ? 'speaking' : ''}`}>
                    <Avatar look={p.look} ring={st.color} size={88} mood={!p.connected ? 'sleep' : p.ready ? 'happy' : 'idle'} />
                    <span>
                      {p.name} {p.ready && '✓'}
                    </span>
                  </div>
                ))}
                {!m.length && <p className="d-empty">waiting for players…</p>}
              </div>
            </div>
          );
        })}
        <p className="d-status">{view.canStart.ok ? 'Ready when the host is! 🎬' : view.canStart.reason}</p>
      </section>
    </div>
  );
}

function DisplayTurn({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const now = useNow(conn.serverNow, 100);
  const cd = useCountdown(view, now);
  const turn = view.turn!;
  const st = teamStyle(view, turn.teamId);
  const describer = playerById(view, turn.describerId);
  const guessers = membersOf(view, turn.teamId).filter((p) => p.id !== turn.describerId);
  const live = view.phase === 'turn-live';
  const [mood, setMood] = useState<'talk' | 'happy' | 'shock'>('talk');

  useEffect(
    () =>
      conn.onEvent((ev) => {
        if (ev.kind === 'correct') setMood('happy');
        if (ev.kind === 'foul' || ev.kind === 'skip') setMood('shock');
        setTimeout(() => setMood('talk'), 700);
      }),
    [conn],
  );

  return (
    <div className="d-turn" style={{ '--team': st.color, '--team-deep': st.deep, '--team-soft': st.soft } as React.CSSProperties}>
      {live && cd.pre > 0 && (
        <div className="countdown d" key={cd.pre}>
          {cd.pre}
        </div>
      )}
      <div className="d-stage">
        <div className="d-turn-label">
          Turn {turn.number}/{view.totalTurns} · <b>{st.name}</b>
        </div>
        <div className="d-center">
          <div className={`d-describer ${describer && conn.speaking.has(describer.id) ? 'speaking' : ''}`}>
            <Avatar look={describer?.look ?? DEFAULT_LOOK} ring={st.color} size={220} mood={live ? mood : describer?.connected ? 'idle' : 'sleep'} />
            <div className="d-name">{describer?.name}</div>
            <div className="d-role">{live ? 'is describing…' : 'is up next!'}</div>
          </div>
          <TimerRing frac={live ? cd.frac : 1} left={live ? cd.left : view.settings.turnSeconds} size={300} color={st.color} />
          <div className="d-guessers">
            {guessers.map((p) => (
              <div key={p.id} className={`d-member ${conn.speaking.has(p.id) ? 'speaking' : ''}`}>
                <Avatar look={p.look} ring={st.color} size={110} mood={live ? (mood === 'happy' ? 'happy' : 'shock') : 'idle'} />
                <span>{p.name}</span>
              </div>
            ))}
            <div className="d-role">{live ? 'SHOUT IT OUT!' : 'get ready to guess'}</div>
          </div>
        </div>
        <div className="d-progress">
          <Pips total={turn.total} outcomes={turn.outcomes} cursor={live ? turn.cursor : -1} />
          <div className="d-points" key={turn.points}>
            {turn.points > 0 ? `+${turn.points}` : turn.points}
            {turn.streak >= 3 && <span className="streak">🔥 {turn.streak} in a row</span>}
          </div>
        </div>
        {!live && <p className="d-status">Waiting for {describer?.name} to press start on their phone…</p>}
      </div>
      <Scoreboard view={view} />
    </div>
  );
}

function Scoreboard({ view }: { view: RoomView }) {
  return (
    <div className="scoreboard">
      {view.teams.map((t) => {
        const st = TEAM_STYLES[t.style];
        const active = view.turn?.teamId === t.id;
        return (
          <div key={t.id} className={`sb-team ${active ? 'active' : ''}`} style={{ '--team': st.color } as React.CSSProperties}>
            <span className="sb-name">{st.name}</span>
            <span className="sb-score" key={t.score}>
              {t.score}
            </span>
            <span className="sb-avatars">
              {membersOf(view, t.id).map((p) => (
                <Avatar key={p.id} look={p.look} ring={st.color} size={34} bob={false} mood={p.connected ? 'idle' : 'sleep'} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function useDisplaySounds(conn: RoomConn, view: RoomView | null, on: boolean) {
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(
    () =>
      conn.onEvent((ev) => {
        if (!onRef.current) return;
        if (ev.kind === 'correct') sfx.correct(ev.streak);
        if (ev.kind === 'skip') sfx.skip();
        if (ev.kind === 'foul') sfx.foul();
        if (ev.kind === 'turn-end') sfx.buzzer();
        if (ev.kind === 'match-end') sfx.fanfare();
        if (ev.kind === 'join') sfx.join();
        if (ev.kind === 'react') sfx.pop();
      }),
    [conn],
  );
  void view;
}
