import { useState } from 'react';
import { AVATAR_COUNT } from '../../../shared/style';
import { Avatar } from '../Avatar';
import { getProfile, type Profile } from '../net';
import { sfx } from '../sfx';

const COLORS = ['#FF4D2E', '#00B8A9', '#FFC22E', '#3A5BFF', '#FF7BAC', '#5BD16B'];

export function ProfileForm({ cta, onSubmit, busy }: { cta: string; onSubmit: (p: Profile) => void; busy?: boolean }) {
  const saved = getProfile();
  const [name, setName] = useState(saved?.name ?? '');
  const [avatar, setAvatar] = useState(saved?.avatar ?? Math.floor(Math.random() * AVATAR_COUNT));
  const ok = name.trim().length > 0;
  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok && !busy) onSubmit({ name: name.trim(), avatar });
      }}
    >
      <div className="me-preview">
        <button
          type="button"
          className="avatar-btn"
          aria-label="Pick a different buzzling"
          onClick={() => {
            sfx.pop();
            setAvatar((a) => (a + 1 + Math.floor(Math.random() * (AVATAR_COUNT - 1))) % AVATAR_COUNT);
          }}
        >
          <Avatar seed={avatar} color={COLORS[avatar % COLORS.length]} size={96} mood="happy" />
          <span className="reroll">🎲</span>
        </button>
        <label className="field grow">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="e.g. Sam"
            autoComplete="nickname"
            enterKeyHint="go"
            maxLength={16}
            name="name"
          />
        </label>
      </div>
      <div className="avatar-grid" role="radiogroup" aria-label="Choose your buzzling">
        {Array.from({ length: 12 }, (_, i) => (avatar - (avatar % 12) + i) % AVATAR_COUNT).map((seed) => (
          <button
            type="button"
            key={seed}
            role="radio"
            aria-checked={seed === avatar}
            className={seed === avatar ? 'on' : ''}
            onClick={() => {
              sfx.pop();
              setAvatar(seed);
            }}
          >
            <Avatar seed={seed} color={COLORS[seed % COLORS.length]} size={44} bob={false} />
          </button>
        ))}
      </div>
      <button className="btn big primary" disabled={!ok || busy}>
        {busy ? 'One sec…' : cta}
      </button>
    </form>
  );
}
