import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel function: ICE servers for voice chat. Set TURN_* env vars for strict networks.
export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const ice: { urls: string[]; username?: string; credential?: string }[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  if (process.env.TURN_URL) ice.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=300');
  res.end(JSON.stringify({ iceServers: ice }));
}
