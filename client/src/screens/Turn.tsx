import { DEFAULT_LOOK } from '../../../shared/looks';
import { useEffect, useRef, useState } from 'react';
import { MODES } from '../../../shared/modes';
import { REACTIONS } from '../../../shared/style';
import type { RoomView } from '../../../shared/types';
import { Avatar } from '../Avatar';
import { useNow, type RoomConn } from '../net';
import { buzz, sfx } from '../sfx';
import { membersOf, Pips, playerById, Seat, Stage, teamStyle, TimerRing, useCountdown } from '../ui';
import { VoiceButton } from './VoiceButton';

export function TurnScreen({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const now = useNow(conn.serverNow, 100);
  const cd = useCountdown(view, now);
  const turn = view.turn!;
  const role = view.me.role;
  const st = teamStyle(view, turn.teamId);
  const describer = playerById(view, turn.describerId);
  const isHost = view.hostId === view.me.id;

  // countdown / tick sounds
  const lastBeep = useRef<number>(-1);
  useEffect(() => {
    if (view.phase !== 'turn-live') return;
    const key = cd.pre > 0 ? 100 + cd.pre : cd.live ? Math.ceil(cd.left) : -1;
    if (key === lastBeep.current) return;
    lastBeep.current = key;
    if (cd.pre > 0) sfx.count();
    else if (key === Math.ceil(view.settings.turnSeconds)) {
      sfx.go();
      buzz(80);
    } else if (cd.live && cd.left <= 5 && cd.left > 0) {
      sfx.tick(true);
      if (role !== 'display') buzz(30);
    }
  }, [cd.pre, cd.left, cd.live, view.phase, view.settings.turnSeconds, role]);

  if (view.phase === 'turn-ready') {
    return (
      <div className="turn-ready" style={{ '--team': st.color, '--team-deep': st.deep } as React.CSSProperties}>
        <div className="turn-num">
          Turn {turn.number} of {view.totalTurns}
        </div>
        {role === 'describer' ? (
          <>
            <Avatar look={describer!.look} ring={st.color} size={140} mood="talk" />
            <h1 className="shout">You’re up!</h1>
            <p className="lead">
              Describe as many words as you can in <b>{view.settings.turnSeconds}s</b>. Don’t say the word
              {MODES[view.settings.modeId].showNogo ? ' or its No-Go words' : ''}. Tap <b>GOT IT</b> when your team shouts it, <b>SKIP</b> if
              you’re stuck.
            </p>
            <button
              className="btn mega"
              onClick={() => {
                sfx.go();
                buzz(40);
                conn.send({ type: 'beginTurn' });
              }}
            >
              Start my turn ▶
            </button>
            <button className="link light" onClick={() => conn.send({ type: 'passTurn' })}>
              Pass to a teammate
            </button>
          </>
        ) : (
          <>
            <Avatar look={describer?.look ?? DEFAULT_LOOK} ring={st.color} size={140} mood={describer?.connected ? 'idle' : 'sleep'} />
            <h1 className="shout">{describer?.name ?? '…'} is up</h1>
            <p className="lead">
              {role === 'guesser' && <>You’re guessing! Get loud. 📣</>}
              {role === 'judge' && (
                <>
                  You’re a <b>judge</b>. You’ll see the secret word — slam <b>BUZZ</b> if they say it
                  {MODES[view.settings.modeId].showNogo ? ' or a No-Go word' : ''}. Don’t blurt it out!
                </>
              )}
              {role === 'spectator' && <>Grab some popcorn 🍿</>}
            </p>
            <p className="waiting">Waiting for {describer?.name} to hit start…</p>
            <Stage view={view} speaking={conn.speaking} size={72} exclude={describer?.id} />
            {isHost && (
              <button className="btn" onClick={() => conn.send({ type: 'passTurn' })}>
                {describer?.connected ? 'Pick another describer' : `${describer?.name} is away — skip to a teammate`}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // ---- live ----
  const countdown =
    cd.pre > 0 ? (
      <div className="countdown" aria-live="assertive" key={cd.pre}>
        {cd.pre}
      </div>
    ) : null;

  if (role === 'describer') return <DescriberLive view={view} conn={conn} cd={cd} countdown={countdown} color={st.color} />;

  return (
    <div className={`turn-live watcher ${role}`} style={{ '--team': st.color, '--team-deep': st.deep, '--team-soft': st.soft } as React.CSSProperties}>
      {countdown}
      <div className="live-top">
        <TimerRing frac={cd.frac} left={cd.left} size={92} color={st.deep} />
        <div className="live-score">
          <span className="pts">{turn.points > 0 ? `+${turn.points}` : turn.points}</span>
          {turn.streak >= 3 && <span className="streak">🔥 {turn.streak} streak</span>}
        </div>
      </div>
      <Pips total={turn.total} outcomes={turn.outcomes} cursor={turn.cursor} />
      {role === 'judge' && turn.card && cd.pre === 0 ? (
        <JudgeCard view={view} conn={conn} />
      ) : (
        <h1 className="shout small">{role === 'guesser' ? 'SHOUT IT!' : `${describer?.name} is describing`}</h1>
      )}
      <Stage view={view} speaking={conn.speaking} size={role === 'judge' ? 70 : 92} />
      <ReactionBar conn={conn} />
    </div>
  );
}

function DescriberLive({
  view,
  conn,
  cd,
  countdown,
  color,
}: {
  view: RoomView;
  conn: RoomConn;
  cd: ReturnType<typeof useCountdown>;
  countdown: React.ReactNode;
  color: string;
}) {
  const turn = view.turn!;
  const mode = MODES[view.settings.modeId];
  const [sent, setSent] = useState<number | null>(null);
  const [flash, setFlash] = useState<'correct' | 'skip' | null>(null);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);
  const locked = sent === turn.cursor || cd.pre > 0 || !turn.card;

  const mark = (outcome: 'correct' | 'skip') => {
    if (locked) return;
    setSent(turn.cursor);
    setFlash(outcome);
    if (outcome === 'correct') {
      sfx.correct(turn.streak + 1);
      buzz(25);
    } else {
      sfx.skip();
      buzz([10, 30, 10]);
    }
    conn.send({ type: 'mark', outcome, cursor: turn.cursor });
  };

  useEffect(() => {
    const t = setTimeout(() => setFlash(null), 280);
    return () => clearTimeout(t);
  }, [flash]);

  // desktop: → / Enter = got it, ← / S = skip
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') mark('correct');
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 's') mark('skip');
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  });

  const word = turn.card?.word ?? '';
  const fit = word.length > 16 ? 'xl' : word.length > 10 ? 'l' : word.length > 6 ? 'm' : 's';

  return (
    <div className={`turn-live describer flash-${flash ?? 'none'}`} style={{ '--team': color } as React.CSSProperties}>
      {countdown}
      <div className="live-top">
        <TimerRing frac={cd.frac} left={cd.left} size={84} color={color} />
        <Pips total={turn.total} outcomes={turn.outcomes} cursor={turn.cursor} />
        <div className="live-score small">
          <span className="pts">{turn.points > 0 ? `+${turn.points}` : turn.points}</span>
          {turn.streak >= 2 && <span className="streak">🔥{turn.streak}</span>}
        </div>
      </div>
      <div className="mate-strip" aria-label="Your guessers">
        {membersOf(view, turn.teamId)
          .filter((p) => p.id !== turn.describerId)
          .map((p) => (
            <Seat key={p.id} view={view} p={p} speaking={conn.speaking.has(p.id)} size={48} showSticker={false} />
          ))}
        <VoiceButton compact />
      </div>
      <div
        className="word-zone"
        onPointerDown={(e) => (drag.current = { x: e.clientX, dx: 0 })}
        onPointerMove={(e) => {
          if (!drag.current) return;
          drag.current.dx = e.clientX - drag.current.x;
          setDx(drag.current.dx);
        }}
        onPointerUp={() => {
          const d = drag.current?.dx ?? 0;
          drag.current = null;
          setDx(0);
          if (d > 90) mark('correct');
          else if (d < -90) mark('skip');
        }}
        onPointerCancel={() => ((drag.current = null), setDx(0))}
      >
        {cd.pre > 0 ? (
          <div className="word-card hidden-card">Get ready…</div>
        ) : (
          <div
            className="word-card"
            key={turn.cursor}
            style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)` }}
            aria-live="assertive"
          >
            <div className="secret-tag">🤫 only you can see this</div>
            <div className={`word fit-${fit}`}>{word || '…'}</div>
            {mode.showNogo && turn.card?.nogo && (
              <div className="nogo">
                <span>No-Go:</span>
                {turn.card.nogo.map((n) => (
                  <b key={n}>{n}</b>
                ))}
              </div>
            )}
            <div className="swipe-hint">swipe → got it · ← skip</div>
          </div>
        )}
      </div>
      <div className="mark-row">
        <button className="btn mark skip" onClick={() => mark('skip')} disabled={locked} aria-label="Skip this word">
          SKIP
          {mode.points.skip < 0 && <small>{mode.points.skip}</small>}
        </button>
        <button className="btn mark correct" onClick={() => mark('correct')} disabled={locked} aria-label="Got it — correct">
          GOT IT!
        </button>
      </div>
      <button className="link light end-early" onClick={() => conn.send({ type: 'endTurnEarly' })}>
        end turn early
      </button>
    </div>
  );
}

function JudgeCard({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const turn = view.turn!;
  const mode = MODES[view.settings.modeId];
  const [sent, setSent] = useState<number | null>(null);
  return (
    <div className="judge">
      <div className="word-card judge-card" key={turn.cursor}>
        <div className="secret-tag">👀 judges only — don’t say it!</div>
        <div className="word fit-m">{turn.card!.word}</div>
        {mode.showNogo && turn.card!.nogo && (
          <div className="nogo">
            <span>No-Go:</span>
            {turn.card!.nogo.map((n) => (
              <b key={n}>{n}</b>
            ))}
          </div>
        )}
      </div>
      <button
        className="btn buzz-btn"
        disabled={sent === turn.cursor}
        onClick={() => {
          setSent(turn.cursor);
          sfx.foul();
          buzz([60, 40, 60]);
          conn.send({ type: 'foul', cursor: turn.cursor });
        }}
      >
        BUZZ!
        <small>they said it ({mode.points.foul})</small>
      </button>
    </div>
  );
}

export function ReactionBar({ conn }: { conn: RoomConn }) {
  return (
    <div className="react-bar" role="group" aria-label="Send a reaction">
      {REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => {
            buzz(8);
            conn.send({ type: 'react', emoji: e });
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
