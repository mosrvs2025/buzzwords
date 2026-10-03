import { useEffect, useRef, useState } from 'react';
import { TEAM_STYLES } from '../../../shared/style';
import type { RoomView } from '../../../shared/types';
import { navigate } from '../nav';
import { getProfile, recordMatch, setProfile, store, useRoom, type RoomConn } from '../net';
import { useVoice, VoiceCtx } from '../voice';
import { stopHosting } from '../host';
import { AnimatedNumber, Moments } from '../fx';
import { VoiceButton } from './VoiceButton';
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
  const voice = useVoice(conn, view);

  // local progress → cosmetic unlocks
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(
    () =>
      conn.onEvent((ev) => {
        const v = viewRef.current;
        if (ev.kind !== 'match-end' || !v?.me.id) return;
        const myTeam = v.players.find((p) => p.id === v.me.id)?.teamId;
        recordMatch(`${v.code}:${v.matchNumber}`, !!myTeam && ev.winners.includes(myTeam));
      }),
    [conn],
  );

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
    <VoiceCtx.Provider value={voice}>
    <main className={`room phase-${view.phase} role-${view.me.role}`}>
      {!(view.phase === 'turn-live' && view.me.role === 'describer') && <TopBar view={view} conn={conn} />}
      {conn.isHostDevice && view.phase === 'lobby' && (
        <div className="host-note" role="note">
          📡 This device is hosting the room — keep this tab open (it’s fine to switch apps briefly).
        </div>
      )}
      {view.phase === 'lobby' && <Lobby view={view} conn={conn} />}
      {inTurn && <TurnScreen view={view} conn={conn} />}
      {view.phase === 'turn-review' && <Review view={view} conn={conn} />}
      {view.phase === 'final' && <Final view={view} conn={conn} />}
      <FxLayer conn={conn} view={view} />
      <Moments conn={conn} view={view} />
      <ConnBanner status={conn.status} />
      <Toast toast={conn.toast} />
    </main>
    </VoiceCtx.Provider>
  );
}

function TopBar({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const [muted, setM] = useState(isMuted());
  const [menu, setMenu] = useState(false);
  const [closet, setCloset] = useState(false);
  const isHost = view.hostId === view.me.id;
  const playing = view.phase !== 'lobby';
  return (
    <header className="topbar">
      <span className="tb-code">{view.code}</span>
      {playing && (
        <div className="mini-scores" aria-label="Scores">
          {view.teams.map((t) => (
            <span key={t.id} style={{ background: TEAM_STYLES[t.style].color }}>
              <AnimatedNumber value={t.score} />
            </span>
          ))}
        </div>
      )}
      <div className="tb-right">
        <VoiceButton />
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
          <button className="menu-item" onClick={() => setCloset(true)}>
            👕 Change my look
          </button>
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
              if (!confirm(conn.isHostDevice ? 'You’re hosting from this device — leaving ends the room for everyone. Leave?' : 'Leave this room? You can rejoin with the code.')) return;
              conn.leave();
              if (conn.isHostDevice) stopHosting(view.code);
              navigate('/');
            }}
          >
            🚪 Leave room
          </button>
        </div>
      )}
      {closet && (
        <div className="modal" role="dialog" aria-label="Change my look" onClick={(e) => e.target === e.currentTarget && setCloset(false)}>
          <div className="card modal-card">
            <button className="link back" onClick={() => setCloset(false)}>
              ✕ close
            </button>
            <ProfileForm
              cta="Save look"
              onSubmit={(p) => {
                setProfile(p);
                conn.send({ type: 'rename', name: p.name, look: p.look });
                setCloset(false);
              }}
            />
          </div>
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
