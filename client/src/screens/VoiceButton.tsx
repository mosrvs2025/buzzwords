import { useVoiceCtx } from '../voice';

/** Join / mute / leave voice. Opt-in: the mic is never touched until tapped. */
export function VoiceButton({ compact = false }: { compact?: boolean }) {
  const v = useVoiceCtx();
  if (!v || typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices) return null;
  if (v.state === 'off' || v.state === 'denied') {
    return (
      <button className={`voice-btn ${compact ? 'compact' : ''}`} onClick={v.join} aria-label={v.state === 'denied' ? 'Mic blocked' : 'Join voice'} title={v.state === 'denied' ? 'Mic blocked — allow it in your browser settings' : 'Talk with remote friends'}>
        🎙️{!compact && <span>{v.state === 'denied' ? ' Mic blocked' : ' Join voice'}</span>}
      </button>
    );
  }
  if (v.state === 'joining') return <button className="voice-btn" disabled>…</button>;
  const muted = v.state === 'muted';
  return (
    <span className="voice-group">
      <button className={`voice-btn live ${muted ? 'muted' : ''}`} onClick={() => v.setMuted(!muted)} aria-pressed={!muted} aria-label={muted ? 'Unmute mic' : 'Mute mic'}>
        {muted ? '🔇' : '🎙️'}
        {!compact && <span>{muted ? ' Muted' : ' Live'}</span>}
      </button>
      {!compact && (
        <button className="voice-btn leave" onClick={v.leave} aria-label="Leave voice">
          ✕
        </button>
      )}
    </span>
  );
}
