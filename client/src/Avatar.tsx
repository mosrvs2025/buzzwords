import { memo } from 'react';
import { HAIR_COLORS, SKINS, TOP_COLORS, type Look } from '../../shared/looks';

export type Mood = 'idle' | 'happy' | 'shock' | 'sad' | 'talk' | 'sleep';

const INK = '#1D1A2B';
const S = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------- hair ----------------
const CAP = 'M31 44 Q29 19 50 18 Q71 19 69 44 Q67 31 57 29 Q50 33 41 30 Q33 32 31 44Z';

function HairBack({ style, c }: { style: number; c: string }) {
  switch (style) {
    case 6: // long
      return <path d="M29 40 Q28 18 50 17 Q72 18 71 40 L74 80 Q50 88 26 80Z" fill={c} {...S} />;
    case 7: // bob
      return <path d="M28 42 Q27 18 50 17 Q73 18 72 42 L72 63 Q50 68 28 63Z" fill={c} {...S} />;
    case 8: // afro
      return <circle cx="50" cy="36" r="27" fill={c} {...S} />;
    default:
      return null;
  }
}

function HairFront({ style, c }: { style: number; c: string }) {
  switch (style) {
    case 1:
      return <path d="M32 40 Q33 21 50 20 Q67 21 68 40 Q62 29 50 28 Q38 29 32 40Z" fill={c} {...S} />;
    case 2:
      return <path d="M31 44 Q28 18 50 17 Q72 18 69 42 Q66 28 54 27 Q46 33 33 33 Q32 37 31 44Z" fill={c} {...S} />;
    case 3:
      return (
        <g fill={c} {...S}>
          {[
            [34, 33], [39, 25], [46, 21], [54, 21], [61, 25], [66, 33],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="7" />
          ))}
        </g>
      );
    case 4:
      return <path d="M30 44 L32 26 L38 30 L40 18 L46 26 L50 14 L54 25 L61 17 L62 29 L69 25 L70 44 Q66 32 50 31 Q36 32 30 44Z" fill={c} {...S} />;
    case 5:
      return (
        <g fill={c} {...S}>
          <circle cx="50" cy="13" r="8" />
          <path d={CAP} />
        </g>
      );
    case 6:
    case 7:
      return <path d="M31 42 Q30 19 50 18 Q70 19 69 42 Q68 33 64 32 L36 32 Q32 33 31 42Z" fill={c} {...S} />;
    case 8:
      return null;
    case 9: // mohawk
      return <path d="M44 32 Q42 8 50 4 Q58 8 56 32 Q50 30 44 32Z" fill={c} {...S} />;
    case 10: // space buns
      return (
        <g fill={c} {...S}>
          <circle cx="33" cy="22" r="8" />
          <circle cx="67" cy="22" r="8" />
          <path d={CAP} />
        </g>
      );
    default:
      return null;
  }
}

// ---------------- face ----------------
function Eyes({ kind, mood }: { kind: number; mood: Mood }) {
  if (mood === 'sleep') {
    return (
      <g fill="none" {...S}>
        <path d="M38 47 q4 3 8 0" />
        <path d="M54 47 q4 3 8 0" />
      </g>
    );
  }
  if (mood === 'happy') {
    return (
      <g fill="none" {...S} strokeWidth={2.8}>
        <path d="M38 48 q4 -6 8 0" />
        <path d="M54 48 q4 -6 8 0" />
      </g>
    );
  }
  const big = mood === 'shock' ? 1.35 : 1;
  switch (kind) {
    case 1:
      return (
        <g>
          {[42, 58].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="46" rx={4.4 * big} ry={4.8 * big} fill="#fff" {...S} strokeWidth={1.6} />
              <circle className="pupil" cx={x + 0.6} cy="46.6" r="2.4" fill={INK} />
              <circle cx={x + 1.4} cy="45.2" r=".8" fill="#fff" />
            </g>
          ))}
        </g>
      );
    case 2:
      return (
        <g>
          {[42, 58].map((x) => (
            <g key={x}>
              <circle cx={x} cy="46" r={2.8 * big} fill={INK} />
              <path d={x < 50 ? `M${x - 4} 43 l-2 -2 M${x - 2} 42 l-1 -2.5` : `M${x + 4} 43 l2 -2 M${x + 2} 42 l1 -2.5`} {...S} strokeWidth={1.4} />
            </g>
          ))}
        </g>
      );
    case 3:
      return (
        <g>
          {[42, 58].map((x) => (
            <g key={x}>
              <circle cx={x} cy="47" r={2.6 * big} fill={INK} />
              <path d={`M${x - 4.5} 45 h9`} {...S} strokeWidth={2} />
            </g>
          ))}
        </g>
      );
    case 4:
      return (
        <g fill="#FFC22E" {...S} strokeWidth={1.2}>
          {[42, 58].map((x) => (
            <path key={x} d={`M${x} ${41.5} l1.6 3.2 3.5 .5 -2.5 2.4 .6 3.5 -3.2 -1.7 -3.2 1.7 .6 -3.5 -2.5 -2.4 3.5 -.5z`} transform={`scale(${big})`} transform-origin={`${x} 46`} />
          ))}
        </g>
      );
    default:
      return (
        <g fill={INK}>
          <circle cx="42" cy="46.5" r={2.7 * big} />
          <circle cx="58" cy="46.5" r={2.7 * big} />
        </g>
      );
  }
}

function Brows({ kind, c }: { kind: number; c: string }) {
  const p = [
    ['M37 40 q5 -2.5 9 -0.5', 'M54 39.5 q4 -2 9 0.5'],
    ['M37 41 q4 -5 9 -2', 'M54 39 q5 -3 9 2'],
    ['M36 40 q5 -3 10 -1', 'M54 39 q5 -2 10 1'],
    ['M37 39 l9 2.5', 'M54 41.5 l9 -2.5'],
  ][kind];
  if (!p) return null;
  return (
    <g fill="none" stroke={kind === 2 ? c : INK} strokeWidth={kind === 2 ? 3.6 : 2.2} strokeLinecap="round">
      <path d={p[0]} />
      <path d={p[1]} />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <g>
          <path d="M42 55 Q50 66 58 55 Z" fill="#7A1F2B" {...S} />
          <path d="M44 56 h12" stroke="#fff" strokeWidth="2" />
        </g>
      );
    case 'shock':
      return <ellipse cx="50" cy="59" rx="3.6" ry="4.6" fill="#7A1F2B" {...S} />;
    case 'sad':
      return <path d="M44 60 q6 -5 12 0" fill="none" {...S} />;
    case 'talk':
      return <ellipse className="talk" cx="50" cy="58" rx="5" ry="3.4" fill="#7A1F2B" {...S} />;
    case 'sleep':
      return <path d="M47 58 h6" {...S} />;
    default:
      return <path d="M44 56 q6 5 12 0" fill="none" {...S} />;
  }
}

function Facial({ kind, c }: { kind: number; c: string }) {
  switch (kind) {
    case 1:
      return <path d="M32 47 Q34 67 50 67 Q66 67 68 47 Q64 59 50 60 Q36 59 32 47Z" fill={c} opacity=".28" />;
    case 2:
      return <path d="M41 54 Q45 50 50 53 Q55 50 59 54 Q55 56 50 55 Q45 56 41 54Z" fill={c} {...S} strokeWidth={1.6} />;
    case 3:
      return <path d="M31 44 Q30 72 50 72 Q70 72 69 44 Q66 56 60 57 Q55 52 50 53 Q45 52 40 57 Q34 56 31 44Z" fill={c} {...S} />;
    case 4:
      return <path d="M44 62 Q50 72 56 62 Q53 64 50 64 Q47 64 44 62Z M43 54 Q50 50 57 54 Q50 55 43 54Z" fill={c} {...S} strokeWidth={1.6} />;
    case 5:
      return <path d="M30 44 Q29 92 50 96 Q71 92 70 44 Q66 56 60 57 Q55 52 50 53 Q45 52 40 57 Q34 56 30 44Z" fill={c} {...S} />;
    default:
      return null;
  }
}

function Glasses({ kind }: { kind: number }) {
  switch (kind) {
    case 1:
      return (
        <g fill="rgba(255,255,255,.25)" {...S}>
          <circle cx="42" cy="46" r="6.5" />
          <circle cx="58" cy="46" r="6.5" />
          <path d="M48.5 46 h3 M35.5 45 l-4 -1 M64.5 45 l4 -1" fill="none" />
        </g>
      );
    case 2:
      return (
        <g fill="rgba(255,255,255,.25)" {...S}>
          <rect x="34.5" y="41" width="14" height="10" rx="2.5" />
          <rect x="51.5" y="41" width="14" height="10" rx="2.5" />
          <path d="M48.5 45 h3" fill="none" />
        </g>
      );
    case 3:
      return (
        <g fill={INK} {...S}>
          <path d="M33 42 h15 q0 10 -7.5 10 q-7.5 0 -7.5 -10z M52 42 h15 q0 10 -7.5 10 q-7.5 0 -7.5 -10z M48 43 h4" />
          <path d="M36 44 l4 0" stroke="#fff" strokeOpacity=".5" />
        </g>
      );
    case 4:
      return (
        <g fill="#FF4D8D" {...S}>
          {[42, 58].map((x) => (
            <path key={x} d={`M${x} 52 l-7 -7 a4 4 0 0 1 7 -4 a4 4 0 0 1 7 4 z`} />
          ))}
          <path d="M48 45 h4" fill="none" />
        </g>
      );
    case 5:
      return (
        <g fill="#FFC22E" {...S}>
          {[42, 58].map((x) => (
            <path key={x} d={`M${x} 38 l2.6 5.3 5.8 .8 -4.2 4.1 1 5.8 -5.2 -2.7 -5.2 2.7 1 -5.8 -4.2 -4.1 5.8 -.8z`} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

function Hat({ kind, hairColor }: { kind: number; hairColor: string }) {
  switch (kind) {
    case 1:
      return (
        <g {...S}>
          <path d="M29 34 Q29 10 50 10 Q71 10 71 34Z" fill="#FF4D2E" />
          <rect x="28" y="29" width="44" height="9" rx="3" fill="#C8341C" />
          <circle cx="50" cy="8" r="5" fill="#FFF7EA" />
        </g>
      );
    case 2:
      return (
        <g {...S}>
          <path d="M30 33 Q30 13 50 13 Q70 13 70 33Z" fill="#3A5BFF" />
          <path d="M52 31 Q74 28 82 35 Q68 38 52 35Z" fill="#2A43C0" />
          <circle cx="50" cy="13" r="2" fill="#2A43C0" />
        </g>
      );
    case 3:
      return (
        <g {...S}>
          <path d="M29 46 Q29 13 50 13 Q71 13 71 46" fill="none" strokeWidth={5} />
          <path d="M29 46 Q29 13 50 13 Q71 13 71 46" fill="none" stroke="#FF7BAC" strokeWidth={2.4} />
          <rect x="23" y="39" width="10" height="17" rx="4" fill="#FF7BAC" />
          <rect x="67" y="39" width="10" height="17" rx="4" fill="#FF7BAC" />
        </g>
      );
    case 4:
      return (
        <g {...S}>
          <path d="M30 32 L32 10 L46 24Z" fill={hairColor === '#1D1A2B' ? '#FFF7EA' : hairColor} />
          <path d="M70 32 L68 10 L54 24Z" fill={hairColor === '#1D1A2B' ? '#FFF7EA' : hairColor} />
          <path d="M33 26 L34 15 L41 22Z M67 26 L66 15 L59 22Z" fill="#FF9EC2" strokeWidth={1.2} />
        </g>
      );
    case 5:
      return (
        <g {...S}>
          <path d="M31 31 L35 13 Q50 9 65 13 L69 31Z" fill="#E0C48A" />
          <ellipse cx="50" cy="31" rx="26" ry="5.5" fill="#D1B070" />
        </g>
      );
    case 6:
      return <ellipse className="halo" cx="50" cy="8" rx="16" ry="4" fill="none" stroke="#FFC22E" strokeWidth="3.5" />;
    case 7:
      return (
        <g {...S}>
          <path d="M33 26 L35 8 L43 17 L50 4 L57 17 L65 8 L67 26Z" fill="#FFC22E" />
          <circle cx="50" cy="20" r="2.4" fill="#FF4D2E" />
        </g>
      );
    case 8:
      return (
        <g {...S}>
          <path d="M40 24 L50 -2 L60 24Z" fill="#00B8A9" />
          <path d="M44 14 L56 14 M42 19 L58 19" stroke="#FFC22E" strokeWidth={3} />
          <circle cx="50" cy="-3" r="3.5" fill="#FF4D2E" />
        </g>
      );
    default:
      return null;
  }
}

function Top({ kind, c, skin }: { kind: number; c: string; skin: string }) {
  const dark = shade(c, -0.15);
  const base = <path d="M14 100 C15 82 28 72 50 72 C72 72 85 82 86 100 Z" fill={c} {...S} />;
  switch (kind) {
    case 1: // hoodie
      return (
        <g>
          {base}
          <path d="M34 74 Q50 64 66 74 Q58 84 50 84 Q42 84 34 74Z" fill={dark} {...S} />
          <path d="M45 82 v9 M55 82 v9" {...S} strokeWidth={1.8} />
        </g>
      );
    case 2: // collared
      return (
        <g>
          {base}
          <path d="M42 72 L50 82 L58 72" fill={skin} {...S} />
          <path d="M40 71 L50 80 L44 85 Z M60 71 L50 80 L56 85 Z" fill="#FFF7EA" {...S} />
        </g>
      );
    case 3: // jersey
      return (
        <g>
          {base}
          <path d="M42 72 Q50 80 58 72" fill={skin} {...S} />
          <path d="M22 86 Q50 80 78 86" fill="none" stroke="#FFF7EA" strokeWidth="4" />
          <text x="50" y="98" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFF7EA" stroke={INK} strokeWidth=".8" fontFamily="system-ui">
            7
          </text>
        </g>
      );
    case 4: // sweater
      return (
        <g>
          {base}
          <path d="M17 88 Q50 82 83 88 M15 95 Q50 89 85 95" fill="none" stroke={shade(c, 0.25)} strokeWidth="3.4" />
          <path d="M42 72 Q50 77 58 72" fill={dark} {...S} />
        </g>
      );
    case 5: // overalls
      return (
        <g>
          {base}
          <path d="M42 72 Q50 78 58 72" fill={skin} {...S} />
          <path d="M33 100 L35 84 L65 84 L67 100Z" fill="#4F7BD9" {...S} />
          <path d="M35 84 L33 74 M65 84 L67 74" stroke="#4F7BD9" strokeWidth="4.5" />
          <circle cx="37" cy="86" r="1.6" fill="#FFC22E" />
          <circle cx="63" cy="86" r="1.6" fill="#FFC22E" />
        </g>
      );
    case 6: // suit
      return (
        <g>
          <path d="M14 100 C15 82 28 72 50 72 C72 72 85 82 86 100 Z" fill="#26233A" {...S} />
          <path d="M43 72 L50 100 L57 72Z" fill="#FFF7EA" {...S} />
          <path d="M48 76 L50 74 L52 76 L51 90 L50 92 L49 90Z" fill={c} {...S} strokeWidth={1.2} />
          <path d="M41 72 L48 92 L38 80 Z M59 72 L52 92 L62 80 Z" fill="#3A3654" {...S} />
        </g>
      );
    case 7: // sequins
      return (
        <g>
          {base}
          <path d="M42 72 Q50 79 58 72" fill={skin} {...S} />
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} className="sparkle" cx={20 + ((i * 17) % 62)} cy={80 + ((i * 7) % 18)} r="1.3" fill="#fff" style={{ animationDelay: `${(i % 5) * 0.2}s` }} />
          ))}
        </g>
      );
    default: // tee
      return (
        <g>
          {base}
          <path d="M42 72 Q50 80 58 72" fill={skin} {...S} />
        </g>
      );
  }
}

/**
 * A customizable cartoon bust in a circular badge. `ring` is the team color.
 * The hat/hair may poke out the top of the circle on purpose.
 */
export const Avatar = memo(function Avatar({
  look,
  ring,
  bg,
  mood = 'idle',
  size = 56,
  bob = true,
  className = '',
}: {
  look: Look;
  ring?: string;
  bg?: string;
  mood?: Mood;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  const skin = SKINS[look.skin] ?? SKINS[0];
  const hairC = HAIR_COLORS[look.hairColor] ?? INK;
  const id = 'avclip';
  return (
    <svg viewBox="-4 -16 108 120" width={size} height={size} className={`avatar ${bob ? 'bob' : ''} mood-${mood} ${className}`} aria-hidden>
      <defs>
        {/* circle at the bottom, open at the top so hats can pop out */}
        <clipPath id={id}>
          <rect x="-20" y="-20" width="140" height="70" />
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill={bg ?? (ring ? shade(ring, 0.28) : '#E9E1D3')} />
      <g clipPath={`url(#${id})`}>
        <g className="avatar-body" transform="translate(50 56) scale(1.3) translate(-50 -50)">
          <HairBack style={look.hair} c={hairC} />
          <Top kind={look.top} c={TOP_COLORS[look.topColor] ?? TOP_COLORS[0]} skin={skin} />
          <path d="M44 58 h12 v16 q-6 4 -12 0z" fill={shade(skin, -0.08)} {...S} />
          <circle cx="31" cy="48" r="4.5" fill={skin} {...S} />
          <circle cx="69" cy="48" r="4.5" fill={skin} {...S} />
          <ellipse cx="50" cy="45" rx="19" ry="22" fill={skin} {...S} />
          <Facial kind={look.facial} c={hairC} />
          <ellipse cx="37" cy="54" rx="4" ry="2.4" fill="#FF7BAC" opacity=".35" />
          <ellipse cx="63" cy="54" rx="4" ry="2.4" fill="#FF7BAC" opacity=".35" />
          <Eyes kind={look.eyes} mood={mood} />
          <Brows kind={look.brows} c={hairC} />
          <path d="M50 47 Q47.5 52 50.5 53" fill="none" {...S} strokeWidth={1.8} />
          <Mouth mood={mood} />
          {look.facial === 2 && <Facial kind={2} c={hairC} />}
          <HairFront style={look.hair} c={hairC} />
          <Glasses kind={look.glasses} />
        </g>
      </g>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke={ring ?? INK} strokeWidth={ring ? 4 : 3} />
      <g transform="translate(50 56) scale(1.3) translate(-50 -50)">
        <Hat kind={look.hat} hairColor={hairC} />
      </g>
    </svg>
  );
});
