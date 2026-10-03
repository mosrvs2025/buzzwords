import { useState } from 'react';
import type { CustomDeck } from '../../../shared/types';
import { navigate } from '../nav';
import { store } from '../net';
import { apiBase } from '../transport';

type SavedDeck = CustomDeck & { id: string; updatedAt: number };

const load = () => store.get<SavedDeck[]>('bw:decks') ?? [];
const save = (d: SavedDeck[]) => store.set('bw:decks', d);

const IDEAS = ['working in a grocery store', 'our family road trips', '90s cartoons', 'things that happen at weddings', 'life as a software engineer', 'Christmas chaos'];

export function DeckStudio() {
  const [decks, setDecks] = useState(load);
  const [edit, setEdit] = useState<SavedDeck | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const persist = (next: SavedDeck[]) => {
    setDecks(next);
    save(next);
  };

  const generate = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`${apiBase}/api/generate-deck`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setEdit({ id: crypto.randomUUID(), name: data.name, words: data.words, updatedAt: Date.now() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (edit) {
    const words = edit.words;
    return (
      <main className="studio">
        <button className="link back" onClick={() => setEdit(null)}>
          ← all decks
        </button>
        <section className="card">
          <label className="field">
            <span>Deck name</span>
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value.slice(0, 32) })} />
          </label>
          <label className="field">
            <span>Words — one per line ({words.filter(Boolean).length})</span>
            <textarea
              rows={14}
              value={words.join('\n')}
              onChange={(e) => setEdit({ ...edit, words: e.target.value.split('\n').map((w) => w.slice(0, 32)) })}
            />
          </label>
          <p className="hint">10+ words to play. With 30+ it replaces the built-in decks; fewer and it’s mixed in.</p>
          <div className="row gap-s">
            <button
              className="btn big primary"
              disabled={words.filter((w) => w.trim()).length < 10 || !edit.name.trim()}
              onClick={() => {
                const clean = { ...edit, words: [...new Set(words.map((w) => w.trim()).filter(Boolean))], updatedAt: Date.now() };
                persist([clean, ...decks.filter((d) => d.id !== edit.id)]);
                setEdit(null);
              }}
            >
              Save deck
            </button>
            {decks.some((d) => d.id === edit.id) && (
              <button
                className="btn big"
                onClick={() => {
                  if (!confirm(`Delete “${edit.name}”?`)) return;
                  persist(decks.filter((d) => d.id !== edit.id));
                  setEdit(null);
                }}
              >
                Delete
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="studio">
      <button className="link back" onClick={() => navigate('/')}>
        ← home
      </button>
      <h1 className="studio-title">✍️ Deck Studio</h1>
      <p className="lead dark">Your decks live on this device. Hosts can load them from the lobby.</p>

      <section className="card stack">
        <h2>✨ Conjure a deck</h2>
        <form
          className="row gap-s"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim().length >= 3) generate();
          }}
        >
          <input value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, 300))} placeholder="Make a funny deck about…" aria-label="Deck topic" />
          <button className="btn primary" disabled={busy || prompt.trim().length < 3}>
            {busy ? 'Brewing…' : 'Make it'}
          </button>
        </form>
        <div className="my-words">
          {IDEAS.map((i) => (
            <button key={i} className="tagchip" onClick={() => setPrompt(i)}>
              {i}
            </button>
          ))}
        </div>
        {err && <p className="err">{err}</p>}
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2>My decks</h2>
          <button className="btn small" onClick={() => setEdit({ id: crypto.randomUUID(), name: '', words: [], updatedAt: Date.now() })}>
            ＋ New by hand
          </button>
        </div>
        {decks.length === 0 && <p className="hint">No decks yet. Inside jokes welcome.</p>}
        {decks.map((d) => (
          <button key={d.id} className="deck-row" onClick={() => setEdit(d)}>
            <b>{d.name}</b>
            <span>{d.words.length} words</span>
          </button>
        ))}
      </section>
    </main>
  );
}
