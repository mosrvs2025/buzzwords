// Tiny synthesized sound kit — no asset downloads, instant on first tap.
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('bw:muted') === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('bw:muted', m ? '1' : '0');
  } catch {
    /* noop */
  }
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** call from any user gesture so iOS lets us play later */
export function unlockAudio() {
  ac();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + (opts.at ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'triangle';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  correct(streak = 1) {
    const base = 660 * Math.pow(1.06, Math.min(streak, 8));
    tone(base, 0.12, { type: 'square', vol: 0.08 });
    tone(base * 1.5, 0.18, { type: 'square', vol: 0.08, at: 0.07 });
  },
  skip() {
    tone(420, 0.18, { type: 'sawtooth', vol: 0.05, slide: 180 });
  },
  foul() {
    tone(140, 0.35, { type: 'sawtooth', vol: 0.12 });
    tone(147, 0.35, { type: 'square', vol: 0.06 });
  },
  tick(urgent = false) {
    tone(urgent ? 1200 : 900, 0.04, { type: 'square', vol: 0.04 });
  },
  count() {
    tone(520, 0.15, { type: 'triangle', vol: 0.15 });
  },
  go() {
    tone(1040, 0.3, { type: 'triangle', vol: 0.18 });
  },
  buzzer() {
    tone(110, 0.6, { type: 'sawtooth', vol: 0.14 });
    tone(116, 0.6, { type: 'sawtooth', vol: 0.1 });
  },
  join() {
    tone(880, 0.08, { vol: 0.08 });
    tone(1320, 0.1, { vol: 0.08, at: 0.06 });
  },
  pop() {
    tone(700, 0.06, { type: 'sine', vol: 0.1, slide: 1100 });
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.07, at: i * 0.12 }));
    tone(1047, 0.7, { type: 'triangle', vol: 0.12, at: 0.5 });
  },
};

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
