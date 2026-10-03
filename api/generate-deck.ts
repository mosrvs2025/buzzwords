import type { IncomingMessage, ServerResponse } from 'node:http';
import { aiEnabled, generateDeck } from '../server/ai';

// Vercel function: AI deck generation (needs ANTHROPIC_API_KEY in the project's env vars).
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const send = (code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  if (!aiEnabled()) return send(501, { error: 'AI decks aren’t switched on for this server yet.' });
  let body = req.body as { prompt?: unknown } | string | undefined;
  if (typeof body === 'string') body = JSON.parse(body);
  const prompt = (body as { prompt?: unknown } | undefined)?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length < 3) return send(400, { error: 'Tell me what the deck is about.' });
  try {
    send(200, await generateDeck(prompt));
  } catch (e) {
    console.error('[ai]', e);
    send(502, { error: e instanceof Error && e.message.length < 80 ? e.message : 'The deck machine jammed. Try again.' });
  }
}
