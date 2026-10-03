import { useMemo } from 'react';
import { TEAM_STYLES } from '../../../shared/style';
import type { RoomView, WordOutcome } from '../../../shared/types';
import { Avatar } from '../Avatar';
import type { RoomConn } from '../net';
import { sfx } from '../sfx';
import { Confetti, membersOf, playerById, standings, teamStyle } from '../ui';

const OUTCOME_LABEL: Record<WordOutcome, string> = { correct: '✓', skip: '↷', foul: '✕ buzz', missed: '⏱' };
const NEXT: Record<WordOutcome, WordOutcome> = { correct: 'skip', skip: 'correct', missed: 'correct', foul: 'correct' };

export function Review({ view, conn, big = false }: { view: RoomView; conn?: RoomConn; big?: boolean }) {
  const turn = view.turn!;
  const st = teamStyle(view, turn.teamId);
  const describer = playerById(view, turn.describerId);
  const me = view.me.id;
  const canEdit = !!conn && (me === turn.describerId || me === view.hostId);
  const myTeam = view.players.find((p) => p.id === me)?.teamId;
  const canConfirm = !!conn && (me === turn.describerId || myTeam === turn.teamId || me === view.hostId);
  const correct = turn.outcomes.filter((o) => o === 'correct').length;
  const isLast = view.turnsPlayed + 1 >= view.totalTurns;

  return (
    <div className={`review ${big ? 'big' : ''}`} style={{ '--team': st.color, '--team-soft': st.soft } as React.CSSProperties}>
      <div className="review-head">
        <Avatar seed={describer?.avatar ?? 0} color={st.color} size={big ? 140 : 90} mood={turn.points >= 5 ? 'happy' : turn.points <= 0 ? 'sad' : 'idle'} />
        <div>
          <div className="eyebrow">Time! {st.name}</div>
          <div className="big-points">{turn.points > 0 ? `+${turn.points}` : turn.points}</div>
          <div className="sub">
            {describer?.name} got {correct} of {turn.revealed?.length ?? 0}
            {turn.revealed?.length === turn.total && turn.outcomes.every((o) => o === 'correct') && ' — CLEAN SWEEP! 🧹'}
          </div>
        </div>
      </div>
      <h3 className="reveal-title">The words were…</h3>
      <ul className="reveal-list">
        {turn.revealed?.map((e, i) => (
          <li key={i} className={e.outcome} style={{ animationDelay: `${i * 0.08}s` }}>
            {canEdit ? (
              <button
                onClick={() => {
                  sfx.pop();
                  conn!.send({ type: 'review', index: i, outcome: NEXT[e.outcome] });
                }}
                aria-label={`${e.card.word}: ${e.outcome}. Tap to change.`}
              >
                <span className="w">{e.card.word}</span>
                <span className="o">{OUTCOME_LABEL[e.outcome]}</span>
              </button>
            ) : (
              <div>
                <span className="w">{e.card.word}</span>
                <span className="o">{OUTCOME_LABEL[e.outcome]}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canEdit && <p className="hint">Mis-tapped? Tap a word to flip it.</p>}
      {conn &&
        (canConfirm ? (
          <button className="btn big primary" onClick={() => (sfx.pop(), conn.send({ type: 'confirmTurn' }))}>
            {isLast ? 'See final results 🏆' : 'Bank it → next team'}
          </button>
        ) : (
          <p className="waiting">Waiting for {st.name} to bank their points…</p>
        ))}
    </div>
  );
}

export function useAwards(view: RoomView) {
  return useMemo(() => {
    const entries = Object.entries(view.stats.byPlayer)
      .map(([id, s]) => ({ p: playerById(view, id), s }))
      .filter((x) => x.p);
    const top = <K extends keyof (typeof entries)[0]['s']>(k: K) => [...entries].sort((a, b) => b.s[k] - a.s[k])[0];
    const out: { title: string; who: string; avatar: number; teamId: string | null; detail: string }[] = [];
    const mvp = top('correct');
    if (mvp && mvp.s.correct > 0) out.push({ title: 'Silver Tongue', who: mvp.p!.name, avatar: mvp.p!.avatar, teamId: mvp.p!.teamId, detail: `${mvp.s.correct} words described` });
    const streak = top('bestStreak');
    if (streak && streak.s.bestStreak >= 3) out.push({ title: 'On Fire', who: streak.p!.name, avatar: streak.p!.avatar, teamId: streak.p!.teamId, detail: `${streak.s.bestStreak} in a row` });
    const skip = top('skips');
    if (skip && skip.s.skips >= 3) out.push({ title: 'Skip Happens', who: skip.p!.name, avatar: skip.p!.avatar, teamId: skip.p!.teamId, detail: `${skip.s.skips} skips` });
    const cop = top('buzzes');
    if (cop && cop.s.buzzes > 0) out.push({ title: 'Word Police', who: cop.p!.name, avatar: cop.p!.avatar, teamId: cop.p!.teamId, detail: `${cop.s.buzzes} buzzes` });
    return out;
  }, [view]);
}

export function Final({ view, conn, big = false }: { view: RoomView; conn?: RoomConn; big?: boolean }) {
  const ranked = standings(view.teams);
  const topScore = ranked[0]?.score ?? 0;
  const winners = ranked.filter((t) => t.score === topScore);
  const tie = winners.length > 1;
  const awards = useAwards(view);
  const isHost = !!conn && view.hostId === view.me.id;
  const colors = winners.map((w) => TEAM_STYLES[w.style].color).concat('#FFF7EA', '#1D1A2B');
  // podium order: 2nd, 1st, 3rd, 4th
  const podium = [ranked[1], ranked[0], ranked[2], ranked[3]].filter(Boolean);

  return (
    <div className={`final ${big ? 'big' : ''}`}>
      <Confetti colors={colors} />
      <div className="eyebrow">Final scores</div>
      <h1 className="winner-title">
        {tie ? 'It’s a tie!' : `${TEAM_STYLES[winners[0].style].name} win!`}
      </h1>
      <div className="podium">
        {podium.map((t) => {
          const st = TEAM_STYLES[t.style];
          const rank = ranked.indexOf(t);
          const won = t.score === topScore;
          return (
            <div key={t.id} className={`step rank${rank}`} style={{ '--team': st.color, '--team-deep': st.deep } as React.CSSProperties}>
              <div className="step-avatars">
                {membersOf(view, t.id).map((p) => (
                  <Avatar key={p.id} seed={p.avatar} color={st.color} size={big ? 72 : 44} mood={won ? 'happy' : 'sad'} />
                ))}
              </div>
              <div className="step-block">
                <span className="step-rank">{won ? '👑' : `#${rank + 1}`}</span>
                <span className="step-score">{t.score}</span>
                <span className="step-name">{st.name}</span>
              </div>
            </div>
          );
        })}
      </div>
      {awards.length > 0 && (
        <div className="awards">
          {awards.map((a) => (
            <div className="award" key={a.title}>
              <Avatar seed={a.avatar} color={teamStyle(view, a.teamId).color} size={44} mood="happy" bob={false} />
              <div>
                <b>{a.title}</b>
                <span>
                  {a.who} · {a.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {conn &&
        (isHost ? (
          <div className="row gap-s final-actions">
            <button className="btn big primary" onClick={() => (sfx.go(), conn.send({ type: 'rematch' }))}>
              🔁 Rematch
            </button>
            <button className="btn big" onClick={() => conn.send({ type: 'backToLobby' })}>
              Change teams
            </button>
          </div>
        ) : (
          <p className="waiting">The host can start a rematch…</p>
        ))}
    </div>
  );
}
