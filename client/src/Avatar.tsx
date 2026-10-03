import { memo } from 'react';

export type Mood = 'idle' | 'happy' | 'shock' | 'sad' | 'talk' | 'sleep';

const INK = '#1D1A2B';

const BODIES = [
  'M18 62c0-25 14-44 32-44s32 19 32 44-13 30-32 30-32-5-32-30z',
  'M20 46c0-14 8-22 22-22h16c14 0 22 8 22 22v24c0 14-8 22-22 22H42c-14 0-22-8-22-22z',
  'M27 58c0-27 9-44 23-44s23 17 23 44-7 34-23 34-23-7-23-34z',
  'M14 64c0-18 16-32 36-32s36 14 36 32-14 28-36 28-36-10-36-28z',
];

function Accessory({ kind, fill }: { kind: number; fill: string }) {
  switch (kind) {
    case 1: // antenna
      return (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round">
          <path d="M50 22 V8" fill="none" />
          <circle cx="50" cy="7" r="5" fill="#FFC22E" />
        </g>
      );
    case 2: // party hat
      return <path d="M38 26 L50 2 L62 26 Z" fill="#3A5BFF" stroke={INK} strokeWidth="4" strokeLinejoin="round" />;
    case 3: // horns
      return (
        <g fill="#FFF7EA" stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M30 30 L26 12 L40 24 Z" />
          <path d="M70 30 L74 12 L60 24 Z" />
        </g>
      );
    case 4: // bow
      return (
        <g fill="#FF7BAC" stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M50 24 L36 14 L36 32 Z" />
          <path d="M50 24 L64 14 L64 32 Z" />
          <circle cx="50" cy="24" r="4" />
        </g>
      );
    case 5: // sprout
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M50 24 V12" fill="none" />
          <path d="M50 14 C40 4 32 10 34 16 C40 18 46 18 50 14 Z" fill="#5BD16B" />
          <path d="M50 14 C60 4 68 10 66 16 C60 18 54 18 50 14 Z" fill="#5BD16B" />
        </g>
      );
    default:
      void fill;
      return null;
  }
}

function Eyes({ kind, mood }: { kind: number; mood: Mood }) {
  if (mood === 'sleep') {
    return (
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M34 56 q6 4 12 0" />
        <path d="M56 56 q6 4 12 0" />
      </g>
    );
  }
  if (mood === 'happy') {
    return (
      <g stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M33 57 q7 -9 14 0" />
        <path d="M55 57 q7 -9 14 0" />
      </g>
    );
  }
  const big = mood === 'shock' ? 1.25 : 1;
  switch (kind) {
    case 1:
      return (
        <g>
          <circle cx="39" cy="54" r={9 * big} fill="#fff" stroke={INK} strokeWidth="4" />
          <circle cx="63" cy="54" r={9 * big} fill="#fff" stroke={INK} strokeWidth="4" />
          <circle className="pupil" cx="41" cy="55" r="4" fill={INK} />
          <circle className="pupil" cx="65" cy="55" r="4" fill={INK} />
        </g>
      );
    case 2:
      return (
        <g>
          <circle cx="51" cy="52" r={13 * big} fill="#fff" stroke={INK} strokeWidth="4" />
          <circle className="pupil" cx="53" cy="53" r="6" fill={INK} />
        </g>
      );
    case 3:
      return (
        <g fill={INK}>
          <rect x="33" y="48" width="10" height={12 * big} rx="5" />
          <rect x="58" y="48" width="10" height={12 * big} rx="5" />
        </g>
      );
    default:
      return (
        <g fill={INK}>
          <circle cx="39" cy="54" r={5.5 * big} />
          <circle cx="62" cy="54" r={5.5 * big} />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return <path d="M38 68 q12 16 26 0 z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
    case 'shock':
      return <ellipse cx="51" cy="74" rx="6" ry="8" fill={INK} />;
    case 'sad':
      return <path d="M40 76 q11 -9 22 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />;
    case 'talk':
      return <ellipse className="talk" cx="51" cy="72" rx="8" ry="5" fill={INK} />;
    case 'sleep':
      return <circle cx="51" cy="72" r="3" fill={INK} />;
    default:
      return <path d="M42 70 q9 7 18 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />;
  }
}

export const Avatar = memo(function Avatar({
  seed,
  color = '#FFF7EA',
  mood = 'idle',
  size = 56,
  bob = true,
  className = '',
}: {
  seed: number;
  color?: string;
  mood?: Mood;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  const body = BODIES[seed % 4];
  const eyes = Math.floor(seed / 4) % 4;
  const acc = Math.floor(seed / 16 + seed) % 6;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`avatar ${bob ? 'bob' : ''} mood-${mood} ${className}`}
      style={{ animationDelay: `${-(seed % 7) * 0.31}s` }}
      aria-hidden
    >
      <ellipse cx="50" cy="95" rx="28" ry="4" fill={INK} opacity=".15" />
      <Accessory kind={acc} fill={color} />
      <path d={body} fill={color} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M30 40 q4 -8 12 -10" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" fill="none" />
      <Eyes kind={eyes} mood={mood} />
      <Mouth mood={mood} />
      {(mood === 'happy' || mood === 'idle') && (
        <g fill="#FF7BAC" opacity=".45">
          <ellipse cx="28" cy="66" rx="5" ry="3" />
          <ellipse cx="74" cy="66" rx="5" ry="3" />
        </g>
      )}
    </svg>
  );
});
