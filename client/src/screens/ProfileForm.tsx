import { useState } from 'react';
import {
  CATALOG, describeUnlock, HAIR_COLORS, isUnlocked, randomLook, SKINS, TOP_COLORS, type Look, type Part, type PartKey,
} from '../../../shared/looks';
import { Avatar } from '../Avatar';
import { getProfile, getProgress, type Profile } from '../net';
import { buzz, sfx } from '../sfx';

type Tab = 'face' | 'hair' | 'fit' | 'extras';
const TABS: { id: Tab; label: string; parts: (PartKey | 'skin' | 'hairColor' | 'topColor')[] }[] = [
  { id: 'face', label: '🙂 Face', parts: ['skin', 'eyes', 'brows', 'facial'] },
  { id: 'hair', label: '💇 Hair', parts: ['hair', 'hairColor'] },
  { id: 'fit', label: '👕 Fit', parts: ['top', 'topColor'] },
  { id: 'extras', label: '🕶️ Extras', parts: ['glasses', 'hat'] },
];
const LABELS: Record<string, string> = {
  skin: 'Skin', eyes: 'Eyes', brows: 'Brows', facial: 'Facial hair', hair: 'Style', hairColor: 'Color',
  top: 'Outfit', topColor: 'Color', glasses: 'Eyewear', hat: 'Headwear',
};
const SWATCHES: Record<string, string[]> = { skin: SKINS, hairColor: HAIR_COLORS, topColor: TOP_COLORS };

export function ProfileForm({ cta, onSubmit, busy }: { cta: string; onSubmit: (p: Profile) => void; busy?: boolean }) {
  const saved = getProfile();
  const [name, setName] = useState(saved?.name ?? '');
  const [look, setLook] = useState<Look>(saved?.look ?? randomLook());
  const [tab, setTab] = useState<Tab>('face');
  const [hint, setHint] = useState('');
  const progress = getProgress();
  const ok = name.trim().length > 0;

  const set = (k: keyof Look, v: number) => {
    sfx.pop();
    buzz(6);
    setLook((l) => ({ ...l, [k]: v }));
  };

  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) onSubmit({ name: name.trim(), look });
      }}
    >
      <div className="me-preview">
        <div className="preview-stage">
          <Avatar look={look} size={124} mood="happy" />
          <button
            type="button"
            className="reroll"
            aria-label="Randomize my look"
            onClick={() => {
              sfx.pop();
              setLook(randomLook());
            }}
          >
            🎲
          </button>
        </div>
        <label className="field grow">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="e.g. Sam" autoComplete="nickname" enterKeyHint="go" maxLength={16} name="name" />
          <small className="progress-note">
            🏅 {progress.games} game{progress.games === 1 ? '' : 's'} · {progress.wins} win{progress.wins === 1 ? '' : 's'} — play more to unlock gear
          </small>
        </label>
      </div>

      <div className="closet">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {TABS.find((t) => t.id === tab)!.parts.map((k) => (
          <div key={k} className="part-row">
            <div className="part-label">{LABELS[k]}</div>
            {SWATCHES[k] ? (
              <div className="swatches" role="radiogroup" aria-label={LABELS[k]}>
                {SWATCHES[k].map((c, i) => (
                  <button
                    type="button"
                    key={c}
                    role="radio"
                    aria-checked={look[k as keyof Look] === i}
                    aria-label={`${LABELS[k]} ${i + 1}`}
                    className={look[k as keyof Look] === i ? 'on' : ''}
                    style={{ background: c }}
                    onClick={() => set(k as keyof Look, i)}
                  />
                ))}
              </div>
            ) : (
              <div className="parts" role="radiogroup" aria-label={LABELS[k]}>
                {(CATALOG[k as PartKey] as Part[]).map((part, i) => {
                  const unlocked = isUnlocked(part.unlock, progress);
                  const on = look[k as keyof Look] === i;
                  return (
                    <button
                      type="button"
                      key={part.name}
                      role="radio"
                      aria-checked={on}
                      aria-label={unlocked ? part.name : `${part.name} — locked: ${describeUnlock(part.unlock!)}`}
                      className={`part ${on ? 'on' : ''} ${unlocked ? '' : 'locked'}`}
                      onClick={() => {
                        if (unlocked) return set(k as keyof Look, i);
                        setHint(`🔒 ${part.name}: ${describeUnlock(part.unlock!)}`);
                        buzz([10, 40, 10]);
                      }}
                    >
                      <Avatar look={{ ...look, [k]: i }} size={58} bob={false} />
                      <span>{part.name}</span>
                      {!unlocked && <em className="lock">🔒 {describeUnlock(part.unlock!)}</em>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {hint && (
          <p className="hint" role="status">
            {hint}
          </p>
        )}
      </div>

      <button className="btn big primary" disabled={!ok || busy}>
        {busy ? 'One sec…' : cta}
      </button>
    </form>
  );
}
