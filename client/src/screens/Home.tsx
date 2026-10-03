import { useState } from 'react';
import type { Look } from '../../../shared/looks';
import { Avatar } from '../Avatar';
import { navigate } from '../nav';
import { startHosting } from '../host';
import { setProfile, store } from '../net';
import { apiBase, detectMode } from '../transport';
import { ProfileForm } from './ProfileForm';

const MASCOT_A: Look = { skin: 4, hair: 8, hairColor: 0, eyes: 1, brows: 1, facial: 0, glasses: 1, hat: 0, top: 1, topColor: 2 };
const MASCOT_B: Look = { skin: 1, hair: 4, hairColor: 4, eyes: 1, brows: 2, facial: 3, glasses: 0, hat: 2, top: 0, topColor: 0 };

export function Home() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'menu' | 'host'>('menu');

  const host = async (p: { name: string; look: Look }) => {
    setBusy(true);
    setErr('');
    try {
      setProfile(p);
      let code: string;
      if ((await detectMode()) === 'server') {
        const res = await fetch(`${apiBase}/api/rooms`, { method: 'POST' });
        code = (await res.json()).code;
      } else {
        // no game server on this deploy: this device hosts the room itself
        code = await startHosting();
      }
      store.set('bw:autojoin', code);
      navigate(`/room/${code}`);
    } catch {
      setErr('Couldn’t open a room — check your connection and try again.');
      setBusy(false);
    }
  };

  const go = async (display = false) => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return setErr('Room codes are 4 letters');
    if ((await detectMode()) === 'server') {
      const res = await fetch(`${apiBase}/api/rooms/${c}`).catch(() => null);
      if (!res?.ok) return setErr(`No room called ${c} 🤔`);
    }
    navigate(`/room/${c}${display ? '/display' : ''}`);
  };

  return (
    <main className="home">
      <header className="hero">
        <div className="marquee">
          <Avatar look={MASCOT_A} ring="#FF4D2E" size={64} mood="talk" />
          <h1 className="logo" aria-label="Buzzwords">
            {'BUZZWORDS'.split('').map((ch, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                {ch}
              </span>
            ))}
          </h1>
          <Avatar look={MASCOT_B} ring="#00B8A9" size={64} mood="shock" />
        </div>
        <p className="tag">Describe the word. Don’t say the word. <b>Shout the word.</b></p>
      </header>

      {mode === 'menu' ? (
        <section className="card stack">
          <button className="btn big primary" onClick={() => setMode('host')}>
            🎤 Host a game
          </button>
          <div className="or">or join friends</div>
          <form
            className="join-row"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, '').slice(0, 4).toUpperCase())}
              placeholder="CODE"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
            />
            <button className="btn big" disabled={code.length !== 4}>
              Join
            </button>
          </form>
          <button className="link" onClick={() => go(true)} disabled={code.length !== 4}>
            📺 Open this room as the TV screen
          </button>
          {err && <p className="err">{err}</p>}
        </section>
      ) : (
        <section className="card">
          <button className="link back" onClick={() => setMode('menu')}>
            ← back
          </button>
          <h2>Who’s hosting?</h2>
          <ProfileForm cta="Open the room →" onSubmit={host} busy={busy} />
          {err && <p className="err">{err}</p>}
        </section>
      )}

      <section className="how">
        <div>
          <b>1</b>
          <p>Host opens a room. Friends scan the code — no app, no accounts.</p>
        </div>
        <div>
          <b>2</b>
          <p>One player sees the secret word and describes it. Their team shouts guesses.</p>
        </div>
        <div>
          <b>3</b>
          <p>The other team watches the word and slams BUZZ if you slip. Got a TV? Open the display.</p>
        </div>
      </section>
      <footer className="foot">
        <a href="/decks" onClick={(e) => (e.preventDefault(), navigate('/decks'))}>
          ✍️ Deck Studio — make your own words
        </a>
      </footer>
    </main>
  );
}
