import { describe, expect, it } from 'vitest';
import { addPlayer, applyAction, autoTeamCount, createRoom, projectView, tick, teamMembers, COUNTDOWN_MS } from './engine';

function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function room(n: number) {
  const s = createRoom('ABCD', 0);
  for (let i = 0; i < n; i++) addPlayer(s, { id: `p${i}`, name: `P${i}`, avatar: i }, i);
  return s;
}

describe('teams', () => {
  it('auto-balances by player count', () => {
    expect([4, 5, 6, 7, 8, 12].map(autoTeamCount)).toEqual([2, 2, 3, 3, 4, 4]);
    const s = room(5);
    expect(s.teams.length).toBe(2);
    expect(s.teams.map((t) => teamMembers(s, t.id).length).sort()).toEqual([2, 3]);
    const six = room(6);
    expect(six.teams.map((t) => teamMembers(six, t.id).length)).toEqual([2, 2, 2]);
  });
});

describe('a full match', () => {
  it('plays turns, rotates describers and teams, and ends', () => {
    const rng = seeded(7);
    const s = room(5);
    const host = s.hostId!;
    expect(() => applyAction(s, 'p1', { type: 'startMatch' }, 0, rng)).toThrow();
    applyAction(s, host, { type: 'startMatch' }, 0, rng);
    expect(s.phase).toBe('turn-ready');
    expect(s.turnsPerTeam).toBe(3); // 3v2 → each team gets 3 turns

    const describers: string[] = [];
    let now = 1000;
    let guard = 0;
    while (s.phase !== 'final' && guard++ < 50) {
      const t = s.turn!;
      describers.push(t.describerId);
      // teammates/display never see the word
      const mate = teamMembers(s, t.teamId).find((p) => p.id !== t.describerId)!;
      applyAction(s, t.describerId, { type: 'beginTurn' }, now, rng);
      now += COUNTDOWN_MS;
      expect(projectView(s, mate.id).turn!.card).toBeNull();
      expect(projectView(s, null).turn!.card).toBeNull();
      expect(projectView(s, t.describerId).turn!.card).not.toBeNull();
      const judge = s.players.find((p) => p.teamId !== t.teamId)!;
      expect(projectView(s, judge.id).turn!.card).not.toBeNull();
      // only the describer may mark
      expect(() => applyAction(s, mate.id, { type: 'mark', outcome: 'correct', cursor: 0 }, now, rng)).toThrow();
      applyAction(s, t.describerId, { type: 'mark', outcome: 'correct', cursor: 0 }, now, rng);
      // duplicate tap is ignored
      applyAction(s, t.describerId, { type: 'mark', outcome: 'correct', cursor: 0 }, now, rng);
      applyAction(s, t.describerId, { type: 'mark', outcome: 'skip', cursor: 1 }, now, rng);
      expect(s.turn!.cursor).toBe(2);
      now += 61_000;
      tick(s, now);
      expect(s.phase).toBe('turn-review');
      expect(projectView(s, mate.id).turn!.revealed!.length).toBe(3); // 2 marked + 1 missed
      applyAction(s, t.describerId, { type: 'confirmTurn' }, now, rng);
    }
    expect(s.phase).toBe('final');
    expect(describers.length).toBe(6);
    // every player described at least once
    expect(new Set(describers).size).toBe(5);
    expect(s.teams.every((t) => t.score === 3)).toBe(true);

    applyAction(s, host, { type: 'rematch' }, now, rng);
    expect(s.phase).toBe('turn-ready');
    expect(s.teams.every((t) => t.score === 0)).toBe(true);
  });

  it('sweeping every card ends the turn with a bonus', () => {
    const rng = seeded(3);
    const s = room(4);
    applyAction(s, s.hostId!, { type: 'settings', patch: { wordsPerTurn: 5 } }, 0, rng);
    applyAction(s, s.hostId!, { type: 'startMatch' }, 0, rng);
    const d = s.turn!.describerId;
    applyAction(s, d, { type: 'beginTurn' }, 0, rng);
    for (let i = 0; i < 5; i++) applyAction(s, d, { type: 'mark', outcome: 'correct', cursor: i }, COUNTDOWN_MS + i, rng);
    expect(s.phase).toBe('turn-review');
    expect(projectView(s, d).turn!.points).toBe(8);
  });

  it('opponents can buzz a foul', () => {
    const rng = seeded(5);
    const s = room(4);
    applyAction(s, s.hostId!, { type: 'startMatch' }, 0, rng);
    const t = s.turn!;
    applyAction(s, t.describerId, { type: 'beginTurn' }, 0, rng);
    const mate = s.players.find((p) => p.teamId === t.teamId && p.id !== t.describerId)!;
    const judge = s.players.find((p) => p.teamId !== t.teamId)!;
    expect(() => applyAction(s, mate.id, { type: 'foul', cursor: 0 }, COUNTDOWN_MS, rng)).toThrow();
    applyAction(s, judge.id, { type: 'foul', cursor: 0 }, COUNTDOWN_MS, rng);
    expect(s.turn!.log[0].outcome).toBe('foul');
    expect(projectView(s, mate.id).turn!.points).toBe(-1);
  });

  it('survives the describer leaving mid-turn', () => {
    const rng = seeded(9);
    const s = room(6);
    applyAction(s, s.hostId!, { type: 'startMatch' }, 0, rng);
    const d = s.turn!.describerId;
    applyAction(s, d, { type: 'beginTurn' }, 0, rng);
    const host = s.hostId === d ? s.players.find((p) => p.id !== d)!.id : s.hostId!;
    s.hostId = host;
    applyAction(s, host, { type: 'kick', playerId: d }, 10, rng);
    // team of 2 lost a member → its only remaining member can't be described to; match ends
    expect(['turn-review', 'final']).toContain(s.phase);
  });
});
