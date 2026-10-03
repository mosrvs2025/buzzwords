import { useState } from 'react';
import { DECKS } from '../../../shared/decks';
import { MODE_LIST, MODES } from '../../../shared/modes';
import { TEAM_STYLES } from '../../../shared/style';
import type { CustomDeck, RoomView } from '../../../shared/types';
import { Avatar } from '../Avatar';
import type { RoomConn } from '../net';
import { store } from '../net';
import { sfx } from '../sfx';
import { joinUrl, membersOf, QR } from '../ui';

export function Lobby({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const me = view.players.find((p) => p.id === view.me.id)!;
  const isHost = view.hostId === me.id;
  const [showQr, setShowQr] = useState(false);
  const readyCount = view.players.filter((p) => p.ready).length;
  const url = joinUrl(view.code);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Buzzwords', text: `Join my Buzzwords game! Code ${view.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShowQr(true);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="lobby">
      <section className="room-card">
        <div>
          <div className="eyebrow">Room code</div>
          <div className="room-code" aria-label={`Room code ${view.code.split('').join(' ')}`}>
            {view.code.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </div>
        <div className="room-actions">
          <button className="btn" onClick={share}>
            🔗 Invite
          </button>
          <button className="btn" onClick={() => setShowQr((s) => !s)} aria-expanded={showQr}>
            ▦ QR
          </button>
        </div>
        {showQr && (
          <div className="qr-pop">
            <QR text={url} size={200} />
            <p>
              Scan to join · or go to <b>{location.host}</b> and type <b>{view.code}</b>
            </p>
            <p className="hint">
              📺 Got a TV or laptop? Open <b>{location.host}/room/{view.code}/display</b> on it for the big screen.
            </p>
          </div>
        )}
      </section>

      <section className="teams">
        <div className="section-head">
          <h2>Teams</h2>
          {isHost && (
            <div className="row gap-s">
              <select
                aria-label="Number of teams"
                value={view.settings.teamCount}
                onChange={(e) => conn.send({ type: 'settings', patch: { teamCount: Number(e.target.value) } })}
              >
                <option value={0}>Auto teams</option>
                <option value={2}>2 teams</option>
                <option value={3}>3 teams</option>
                <option value={4}>4 teams</option>
              </select>
              <button className="btn small" onClick={() => (sfx.pop(), conn.send({ type: 'shuffleTeams' }))}>
                🔀 Shuffle
              </button>
            </div>
          )}
        </div>
        <div className={`team-grid n${view.teams.length}`}>
          {view.teams.map((t) => {
            const st = TEAM_STYLES[t.style];
            const members = membersOf(view, t.id);
            const mine = me.teamId === t.id;
            return (
              <div key={t.id} className={`team-col ${mine ? 'mine' : ''}`} style={{ '--team': st.color, '--team-soft': st.soft } as React.CSSProperties}>
                <button
                  className="team-head"
                  onClick={() => !mine && conn.send({ type: 'setTeam', playerId: me.id, teamId: t.id })}
                  aria-label={mine ? `Team ${st.name} (your team)` : `Switch to team ${st.name}`}
                >
                  {st.name}
                  {!mine && <small>tap to join</small>}
                </button>
                <ul>
                  {members.map((p) => (
                    <li key={p.id}>
                      <button
                        className={`member ${p.connected ? '' : 'offline'} ${conn.speaking.has(p.id) ? 'speaking' : ''}`}
                        disabled={!isHost}
                        title={isHost ? 'Tap to move to the next team' : undefined}
                        onClick={() => {
                          const i = view.teams.findIndex((x) => x.id === p.teamId);
                          conn.send({ type: 'setTeam', playerId: p.id, teamId: view.teams[(i + 1) % view.teams.length].id });
                        }}
                      >
                        <Avatar look={p.look} ring={st.color} size={40} mood={!p.connected ? 'sleep' : conn.speaking.has(p.id) ? 'talk' : p.ready ? 'happy' : 'idle'} bob={false} />
                        <span className="name">
                          {p.name}
                          {p.id === me.id && <em> (you)</em>}
                          {p.id === view.hostId && <span className="host-badge">HOST</span>}
                          {p.voice !== 'off' && <span className="host-badge mic-badge">{p.voice === 'muted' ? '🔇' : '🎙️'}</span>}
                        </span>
                        <span className={`ready-dot ${p.ready ? 'on' : ''}`} aria-label={p.ready ? 'ready' : 'not ready'}>
                          {p.ready ? '✓' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                  {members.length < 2 && <li className="empty">needs {2 - members.length} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
        {isHost && view.players.length > 1 && <p className="hint">Host tip: tap a player to move them. Players can tap a team name to switch.</p>}
      </section>

      <WordJar view={view} conn={conn} />
      <Settings view={view} conn={conn} isHost={isHost} />

      <div className="dock">
        <button
          className={`btn big ${me.ready ? 'ready-on' : ''}`}
          onClick={() => {
            sfx.pop();
            conn.send({ type: 'ready', ready: !me.ready });
          }}
          aria-pressed={me.ready}
        >
          {me.ready ? '✓ Ready!' : 'I’m ready'}
        </button>
        {isHost ? (
          <button className="btn big primary" disabled={!view.canStart.ok} onClick={() => conn.send({ type: 'startMatch' })}>
            {view.canStart.ok ? `Start! (${readyCount}/${view.players.length} ready)` : view.canStart.reason}
          </button>
        ) : (
          <div className="dock-note">{view.canStart.ok ? 'Waiting for the host to start…' : view.canStart.reason}</div>
        )}
      </div>
    </div>
  );
}

function WordJar({ view, conn }: { view: RoomView; conn: RoomConn }) {
  const [word, setWord] = useState('');
  return (
    <section className="card jar">
      <div className="section-head">
        <h2>🫙 The Word Jar</h2>
        <span className="jar-count" aria-live="polite">
          {view.roomWordCount} secret word{view.roomWordCount === 1 ? '' : 's'}
        </span>
      </div>
      <p className="hint">
        Drop in inside jokes, names, places only your crew knows. It’s anonymous — they get shuffled into the deck.
        {!view.settings.useRoomWords && ' (The host has the jar switched off.)'}
      </p>
      <form
        className="row gap-s"
        onSubmit={(e) => {
          e.preventDefault();
          if (word.trim().length < 2) return;
          conn.send({ type: 'addRoomWord', word });
          sfx.pop();
          setWord('');
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value.slice(0, 32))} placeholder="e.g. Uncle Dave’s boat" aria-label="Add a word to the jar" />
        <button className="btn" disabled={word.trim().length < 2}>
          Drop
        </button>
      </form>
      {view.myRoomWords.length > 0 && (
        <div className="my-words">
          {view.myRoomWords.map((w) => (
            <button key={w} className="tagchip" onClick={() => conn.send({ type: 'removeRoomWord', word: w })} aria-label={`Remove ${w}`}>
              {w} ✕
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Settings({ view, conn, isHost }: { view: RoomView; conn: RoomConn; isHost: boolean }) {
  const s = view.settings;
  const set = (patch: Partial<RoomView['settings']>) => conn.send({ type: 'settings', patch });
  const myDecks = store.get<(CustomDeck & { id: string })[]>('bw:decks') ?? [];
  const mode = MODES[s.modeId];

  if (!isHost) {
    return (
      <section className="card">
        <h2>Tonight’s game</h2>
        <p className="summary">
          <b>{mode.name}</b> — {mode.tagline} · {s.turnSeconds}s turns · {s.wordsPerTurn} words ·{' '}
          {view.customDeckName ? `“${view.customDeckName}”` : s.deckIds.map((d) => DECKS.find((x) => x.id === d)?.name).join(', ')}
        </p>
      </section>
    );
  }
  return (
    <section className="card settings">
      <h2>Game setup</h2>
      <div className="mode-grid" role="radiogroup" aria-label="Game mode">
        {MODE_LIST.map((m) => (
          <button key={m.id} role="radio" aria-checked={s.modeId === m.id} className={`mode ${s.modeId === m.id ? 'on' : ''}`} onClick={() => set({ modeId: m.id })}>
            <b>{m.name}</b>
            <span>{m.tagline}</span>
          </button>
        ))}
      </div>
      <ul className="rules">
        {mode.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <div className="setting-row">
        <span>Turn length</span>
        <div className="seg">
          {[30, 45, 60, 90].map((n) => (
            <button key={n} className={s.turnSeconds === n ? 'on' : ''} onClick={() => set({ turnSeconds: n })}>
              {n}s
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span>Words per turn</span>
        <div className="seg">
          {[8, 10, 12, 15].map((n) => (
            <button key={n} className={s.wordsPerTurn === n ? 'on' : ''} onClick={() => set({ wordsPerTurn: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span>Rounds (everyone describes)</span>
        <div className="seg">
          {[1, 2, 3].map((n) => (
            <button key={n} className={s.laps === n ? 'on' : ''} onClick={() => set({ laps: n })}>
              {n}×
            </button>
          ))}
        </div>
      </div>

      <h3>Decks</h3>
      <div className="deck-quick">
        <button className="btn small" onClick={() => set({ deckIds: DECKS.filter((d) => d.id !== 'spicy' && d.id !== 'work').map((d) => d.id) })}>
          🎲 Everything (family-safe)
        </button>
        <button className="btn small" onClick={() => set({ deckIds: DECKS.map((d) => d.id) })}>
          🌶️ Everything
        </button>
        <button className="btn small" onClick={() => set({ deckIds: ['family', 'animals', 'food', 'holidays'] })}>
          🧸 Kids
        </button>
      </div>
      <div className="deck-grid">
        {DECKS.map((d) => {
          const on = s.deckIds.includes(d.id);
          return (
            <button
              key={d.id}
              className={`deck ${on ? 'on' : ''}`}
              aria-pressed={on}
              onClick={() => set({ deckIds: on ? s.deckIds.filter((x) => x !== d.id) : [...s.deckIds, d.id] })}
            >
              <span className="deck-emoji">{d.emoji}</span>
              <b>{d.name}</b>
              <small>{d.blurb}</small>
            </button>
          );
        })}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={s.useRoomWords} onChange={(e) => set({ useRoomWords: e.target.checked })} />
        Mix in the Word Jar ({view.roomWordCount})
      </label>

      <h3>Your custom decks</h3>
      {view.customDeckName && (
        <p className="summary">
          Playing with <b>“{view.customDeckName}”</b> ({view.customDeckSize} words){view.customDeckSize < 30 ? ' + the decks above' : ''}.{' '}
          <button className="link" onClick={() => conn.send({ type: 'setCustomDeck', deck: null })}>
            remove
          </button>
        </p>
      )}
      {myDecks.length ? (
        <div className="my-words">
          {myDecks.map((d) => (
            <button key={d.id} className="tagchip" onClick={() => conn.send({ type: 'setCustomDeck', deck: { name: d.name, words: d.words } })}>
              ＋ {d.name} ({d.words.length})
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">
          Make one in the{' '}
          <a href="/decks" target="_blank" rel="noreferrer">
            Deck Studio
          </a>{' '}
          (opens a new tab, you’ll stay in the room).
        </p>
      )}
    </section>
  );
}
