import Anthropic from '@anthropic-ai/sdk';

/** AI deck generation. Optional: only enabled when ANTHROPIC_API_KEY is set. */
export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

export async function generateDeck(prompt: string): Promise<{ name: string; words: string[] }> {
  client ??= new Anthropic();
  const topic = prompt.slice(0, 300);
  const params = {
    model: process.env.DECK_MODEL || 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system:
      'You write decks for a party game where one player describes a word and teammates shout guesses. ' +
      'Good words are concrete, describable in under 10 seconds, funny when relevant, 1-3 words long, and recognizable to the group. ' +
      'Keep content friendly for mixed company unless the user clearly asks otherwise. ' +
      'Reply with JSON only: {"name": "<short punchy deck name>", "words": ["...", ...]} with 40 words.',
    messages: [{ role: 'user' as const, content: `Make a deck about: ${topic}` }],
  };
  // fallbacks/betas aren't in every SDK type version yet, so pass through untyped
  const res = (await client.beta.messages.create(params as never)) as Anthropic.Beta.BetaMessage;
  if (res.stop_reason === 'refusal') throw new Error('That topic was declined — try another.');
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(json) as { name?: string; words?: unknown[] };
  const words = [...new Set((parsed.words ?? []).filter((w): w is string => typeof w === 'string').map((w) => w.trim()).filter(Boolean))];
  if (words.length < 10) throw new Error('The deck came back too small — try again.');
  return { name: String(parsed.name || topic).slice(0, 32), words: words.slice(0, 80) };
}
