import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { PlayerRoom } from './screens/PlayerRoom';
import { Display } from './screens/Display';
import { DeckStudio } from './screens/DeckStudio';
import { unlockAudio } from './sfx';
import './styles.css';

function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  const m = path.match(/^\/room\/([A-Za-z]{4})(\/display)?\/?$/);
  if (m) {
    const code = m[1].toUpperCase();
    return m[2] ? <Display code={code} key={code + 'd'} /> : <PlayerRoom code={code} key={code} />;
  }
  if (path.startsWith('/decks')) return <DeckStudio />;
  return <Home />;
}

addEventListener('pointerdown', unlockAudio, { once: true });
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});

createRoot(document.getElementById('root')!).render(<App />);
