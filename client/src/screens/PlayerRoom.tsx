import { useEffect, useState } from 'react';
import { TEAM_STYLES } from '../../../shared/style';
import type { RoomView } from '../../../shared/types';
import { navigate } from '../nav';
import { getProfile, store, useRoom, type RoomConn } from '../net';
import { buzz, isMuted, setMuted, sfx } from '../sfx';
import { ConnBanner, FxLayer, Toast } from '../ui';
import { Lobby } from './Lobby';
import { ProfileForm } from './ProfileForm';
import { Final, Review } from './Results';
import { TurnScreen } from './Turn';

export function PlayerRoom({ code }: { code: string }) {
  const conn = useRoom(code);
  const { view, needsName, fatal } = conn;

  // host who just created the room: skip the join form
  useEffect(() => {
    if (needsName && store.get('bw:autojoin') === code) {
      const p = getProfile();
      store.set('bw:autojoin', null);
      if (p) conn.join(p);
    }
  }, [needsName, code, conn]);

  useGameSounds(conn, view);

  if (fatal) {
    return (
      <main className="center-page">
        <div className="card">
          <h1>😵 {fatal}</h1>
          <button className="btn big primary" onClick={() => navigate('/')}>
            Back home
          </button>
        </div>
      </main>
    );
  }

  if (needsName) {
    return (
      <main className="center-page join-page">
        <div className="card">
          <div className="eyebrow">Joining room</div>
          <div className="room-code small">
            {code.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <ProfileForm cta="Jump in →" onSubmit={conn.join} />
        </div>
        <Toast toast={conn.toast} />
      </main>
    );
  }

  if (!view) {
    return (
      <main className="center-page">
        <ConnBanner status={conn.status === 'open' ? 'connecting' : conn.status} />
      </main>
    );
  }

  const inTurn = view.phase === 'turn-ready' || view.phase === 'turn-live';
  return (
    <main className={`room phase-${view.phase} role-${view.me.role}`}>
      {!(view.phase === 'turn-live' && view.me.role === 'describer') && <TopBar view={view} conn={conn} />}
      {view.phase === 'lobby' && <Lobby view={view} conn={conn} />}
      {inTurn && <TurnScreen view={view} conn={conn} />}
      {view.phase === 'turn-review' && <Review view={view} conn={conn} />}
      {view.phase === 'final' && <Final view={view} conn={conn} />}
      <FxLayer conn={conn} view={view} />
      <ConnBanner status={conn.status} />
      <Toast toast={conn.toast} />
    </main>
  );
}

function TopBar({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const [muted, setM] = useState(isMuted());
  const [menu, setMenu] = useState(false);
  const isHost = view.hostId === view.me.id;
  const playing = view.phase !== 'lobby';
  return (
    <header className="topbar">
      <span className="tb-code">{view.code}</span>
      {playing && (
        <div className="mini-scores" aria-label="Scores">
          {view.teams.map((t) => (
            <span key={t.id} style={{ background: TEAM_STYLES[t.style].color }}>
              {t.score}
            </span>
          ))}
        </div>
      )}
      <div className="tb-right">
        <button
          className="icon-btn"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="icon-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          ☰
        </button>
      </div>
      {menu && (
        <div className="menu" onClick={() => setMenu(false)}>
          <a className="menu-item" href={`/room/${view.code}/display`} target="_blank" rel="noreferrer">
            📺 Open TV display
          </a>
          {isHost && playing && view.phase !== 'final' && (
            <button className="menu-item" onClick={() => confirm('End the game now and show results?') && conn.send({ type: 'endMatch' })}>
              🏁 End game now
            </button>
          )}
          <button
            className="menu-item"
            onClick={() => {
              if (!confirm('Leave this room? You can rejoin with the code.')) return;
              conn.leave();
              navigate('/');
            }}
          >
            🚪 Leave room
          </button>
        </div>
      )}
    </header>
  );
}

/** Sounds + haptics for things that happen to *other* people. */
function useGameSounds(conn: RoomConn, view: RoomView | null) {
  const role = view?.me.role;
  const myTeam = view?.players.find((p) => p.id === view.me.id)?.teamId;
  useEffect(
    () =>
      conn.onEvent((ev) => {
        if (ev.kind === 'correct' && role !== 'describer') {
          sfx.correct(ev.streak);
          if (ev.teamId === myTeam) buzz(20);
        }
        if (ev.kind === 'skip' && role !== 'describer') sfx.skip();
        if (ev.kind === 'foul') {
          sfx.foul();
          buzz([80, 40, 80]);
        }
        if (ev.kind === 'turn-end') {
          sfx.buzzer();
          buzz(300);
        }
        if (ev.kind === 'match-end') sfx.fanfare();
        if (ev.kind === 'join') sfx.join();
        if (ev.kind === 'react') sfx.pop();
      }),
    [conn, role, myTeam],
  );
}
