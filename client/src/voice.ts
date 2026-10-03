import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/types';
import type { RoomConn } from './net';

/**
 * Opt-in voice chat for remote play: a small WebRTC mesh (fine for party
 * sizes) with signaling over the game socket. Each client runs its own voice
 * activity detection and tells the room when it's talking, so every screen —
 * including the TV — can light up whoever is speaking.
 */

type Signal = { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };

let iceCache: RTCIceServer[] | null = null;
async function iceServers(): Promise<RTCIceServer[]> {
  if (iceCache) return iceCache;
  try {
    iceCache = (await (await fetch('/api/ice')).json()).iceServers;
  } catch {
    iceCache = [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return iceCache!;
}

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pending: RTCIceCandidateInit[];
}

export type VoiceState = 'off' | 'joining' | 'on' | 'muted' | 'denied';

export function useVoice(conn: RoomConn, view: RoomView | null) {
  const meId = view?.me.id ?? null;
  const me = view?.players.find((p) => p.id === meId);
  const [state, setState] = useState<VoiceState>('off');
  const stream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const vadStop = useRef<(() => void) | null>(null);
  const mutedRef = useRef(false);
  const [rev, setRev] = useState(0);

  const signal = useCallback((to: string, data: Signal) => conn.raw({ t: 'rtc', to, data }), [conn]);

  const closePeer = useCallback((id: string) => {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    p.audio.remove();
    peers.current.delete(id);
  }, []);

  const makePeer = useCallback(
    (id: string) => {
      // synchronous on purpose: no await between "decide to connect" and "register peer",
      // so we can't create duplicate connections or drop early ICE candidates
      const pc = new RTCPeerConnection({ iceServers: iceCache ?? [] });
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.dataset.peer = id;
      document.body.appendChild(audio);
      const peer: Peer = { pc, audio, pending: [] };
      peers.current.set(id, peer);
      stream.current?.getTracks().forEach((t) => pc.addTrack(t, stream.current!));
      pc.onicecandidate = (e) => e.candidate && signal(id, { ice: e.candidate.toJSON() });
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(id);
          setRev((r) => r + 1); // let the roster effect rebuild it
        }
      };
      return peer;
    },
    [signal, closePeer],
  );

  // incoming signaling
  useEffect(
    () =>
      conn.onRtc(async (from, raw) => {
        if (!stream.current) return;
        const data = raw as Signal;
        let peer = peers.current.get(from);
        try {
          if (data.sdp) {
            if (data.sdp.type === 'offer') {
              if (peer) closePeer(from); // they restarted; start clean
              peer = makePeer(from);
              await peer.pc.setRemoteDescription(data.sdp);
              const answer = await peer.pc.createAnswer();
              await peer.pc.setLocalDescription(answer);
              signal(from, { sdp: peer.pc.localDescription!.toJSON() });
            } else if (peer && peer.pc.signalingState === 'have-local-offer') {
              await peer.pc.setRemoteDescription(data.sdp);
            }
            for (const c of peer?.pending.splice(0) ?? []) await peer!.pc.addIceCandidate(c).catch(() => {});
          } else if (data.ice && peer) {
            if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.ice).catch(() => {});
            else peer.pending.push(data.ice);
          }
        } catch (e) {
          console.warn('[voice] signaling error', e);
        }
      }),
    [conn, makePeer, closePeer, signal],
  );

  // keep the mesh in sync with who's in voice. Lower id makes the offer, so there's no glare.
  const roster = view?.players
    .filter((p) => p.id !== meId && p.connected && p.voice !== 'off')
    .map((p) => p.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!stream.current || !meId || (state !== 'on' && state !== 'muted')) return;
    const want = new Set(roster ? roster.split(',') : []);
    for (const id of [...peers.current.keys()]) if (!want.has(id)) closePeer(id);
    for (const id of want) {
      if (peers.current.has(id) || meId > id) continue;
      const peer = makePeer(id);
      void (async () => {
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        signal(id, { sdp: peer.pc.localDescription!.toJSON() });
      })();
    }
  }, [roster, meId, state, rev, makePeer, closePeer, signal]);

  const leave = useCallback(() => {
    vadStop.current?.();
    vadStop.current = null;
    for (const id of [...peers.current.keys()]) closePeer(id);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    conn.raw({ t: 'speak', on: false });
    conn.send({ type: 'voice', state: 'off' });
    setState('off');
  }, [conn, closePeer]);

  const join = useCallback(async () => {
    setState('joining');
    await iceServers();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setState('denied');
      return;
    }
    mutedRef.current = false;
    vadStop.current = startVad(stream.current, (on) => conn.raw({ t: 'speak', on: on && !mutedRef.current }));
    conn.send({ type: 'voice', state: 'on' });
    setState('on');
  }, [conn]);

  const setMuted = useCallback(
    (muted: boolean) => {
      mutedRef.current = muted;
      stream.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
      if (muted) conn.raw({ t: 'speak', on: false });
      conn.send({ type: 'voice', state: muted ? 'muted' : 'on' });
      setState(muted ? 'muted' : 'on');
    },
    [conn],
  );

  // the server forgets voice on reconnect; re-announce if we still hold the mic
  useEffect(() => {
    if (conn.status === 'open' && stream.current && me && me.voice === 'off' && (state === 'on' || state === 'muted')) {
      conn.send({ type: 'voice', state });
    }
  }, [conn, conn.status, me, state]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, join, leave, setMuted, peerCount: peers.current.size };
}

function startVad(stream: MediaStream, onChange: (on: boolean) => void): () => void {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let on = false;
  let lastLoud = 0;
  const t = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    if (rms > (on ? 0.012 : 0.02)) lastLoud = now;
    const next = now - lastLoud < 300; // hangover so words don't flicker
    if (next !== on) {
      on = next;
      onChange(on);
    }
  }, 80);
  return () => {
    clearInterval(t);
    void ctx.close();
  };
}

export type Voice = ReturnType<typeof useVoice>;
export const VoiceCtx = createContext<Voice | null>(null);
export const useVoiceCtx = () => useContext(VoiceCtx);
