// End-to-end: 5 real browser players + 1 TV display play a complete match
// against the production server, over real WebSockets.
//   npm run build && npm run e2e
import { chromium, devices } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 8899;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.resolve('e2e/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const dataFile = path.join(os.tmpdir(), `bw-e2e-${Date.now()}.json`);

const log = (...a) => console.log('•', ...a);
const assert = (c, msg) => {
  if (!c) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ✓', msg);
};

const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_FILE: dataFile }, stdio: 'pipe' });
server.stdout.on('data', (d) => process.env.DEBUG && process.stdout.write('[srv] ' + d));
server.stderr.on('data', (d) => process.stdout.write('[srv!] ' + d));
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE + '/api/health')).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const phone = devices['Pixel 7'];
let failed = false;

try {
  const mk = async (opts = phone) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    return { ctx, page };
  };

  // ---------- host creates the room ----------
  const host = await mk();
  await host.page.goto(BASE);
  await host.page.screenshot({ path: `${SHOTS}/01-home.png` });
  await host.page.getByRole('button', { name: /Host a game/ }).click();
  await host.page.locator('input[name=name]').fill('Ava');
  await host.page.getByRole('button', { name: /Open the room/ }).click();
  await host.page.waitForURL(/\/room\/[A-Z]{4}$/);
  const code = host.page.url().split('/').pop();
  await host.page.locator('.room-code').waitFor();
  log('room', code);

  // ---------- TV display, recording every byte it receives ----------
  const tv = await mk({ viewport: { width: 1920, height: 1080 } });
  const tvFrames = [];
  tv.page.on('websocket', (ws) => ws.on('framereceived', (f) => tvFrames.push(String(f.payload))));
  await tv.page.goto(`${BASE}/room/${code}/display`);

  // ---------- 4 friends join via the room URL (what the QR encodes) ----------
  const names = ['Ben', 'Cleo', 'Dev', 'Eli'];
  const players = [{ name: 'Ava', ...host }];
  for (const n of names) {
    const p = await mk(n === 'Dev' ? { viewport: { width: 1280, height: 800 } } : phone); // one desktop player
    await p.page.goto(`${BASE}/room/${code}`);
    await p.page.locator('input[name=name]').fill(n);
    await p.page.getByRole('button', { name: /Jump in/ }).click();
    await p.page.locator('.lobby').waitFor();
    players.push({ name: n, ...p });
  }
  await tv.page.getByText('Eli').waitFor();
  assert(true, '5 players joined; TV sees all of them');

  // auto teams: 5 players → 2 teams (3v2)
  const teamCols = await host.page.locator('.team-col').count();
  assert(teamCols === 2, `auto-balanced into ${teamCols} teams`);
  const sizes = await host.page.locator('.team-col').evaluateAll((els) => els.map((e) => e.querySelectorAll('.member').length).sort());
  assert(JSON.stringify(sizes) === '[2,3]', `team sizes 3v2 (${sizes})`);

  // word jar contribution (anonymous)
  await players[1].page.getByLabel('Add a word to the jar').fill('Grandma’s meatloaf');
  await players[1].page.getByRole('button', { name: 'Drop' }).click();
  await host.page.getByText('1 secret word').waitFor();
  assert(!(await host.page.getByText('Grandma’s meatloaf').count()), 'jar words are anonymous/hidden from others');

  // host: 30s turns
  await host.page.getByRole('button', { name: '30s' }).click();

  for (const p of players) await p.page.getByRole('button', { name: /I’m ready/ }).click();
  await host.page.getByRole('button', { name: /Start! \(5\/5 ready\)/ }).waitFor();
  await host.page.screenshot({ path: `${SHOTS}/02-lobby-host.png`, fullPage: true });
  await tv.page.screenshot({ path: `${SHOTS}/03-tv-lobby.png` });
  await host.page.getByRole('button', { name: /Start!/ }).click();

  // ---------- play every turn ----------
  const findRole = async () => {
    for (const p of players) {
      const role = await p.page.locator('main.room').getAttribute('class');
      p.role = role?.match(/role-(\w+)/)?.[1];
    }
    return players;
  };

  let turn = 0;
  let didReconnect = false;
  let didTimeout = false;
  const seenWords = [];
  while (true) {
    await host.page.waitForSelector('main.phase-turn-ready, main.phase-final');
    if (await host.page.locator('main.phase-final').count()) break;
    turn++;
    for (const p of players) await p.page.locator('.turn-num', { hasText: `Turn ${turn} of` }).waitFor();
    await findRole();
    const describer = players.find((p) => p.role === 'describer');
    const guessers = players.filter((p) => p.role === 'guesser');
    const judges = players.filter((p) => p.role === 'judge');
    log(`turn ${turn}: ${describer.name} describes → ${guessers.map((g) => g.name)} guess, ${judges.map((j) => j.name)} judge`);
    assert(guessers.length >= 1 && judges.length >= 2, 'roles assigned: 1 describer, teammates guess, other team judges');

    await describer.page.getByRole('button', { name: /Start my turn/ }).click();
    await describer.page.locator('.word-card .word').waitFor({ timeout: 6000 });
    const word = (await describer.page.locator('.word-card .word').innerText()).trim();
    seenWords.push(word);
    log(`  secret word #1: ${word}`);
    if (turn === 1) {
      await describer.page.screenshot({ path: `${SHOTS}/04-describer.png` });
      await guessers[0].page.screenshot({ path: `${SHOTS}/05-guesser.png` });
      await judges[0].page.screenshot({ path: `${SHOTS}/06-judge.png` });
      await tv.page.screenshot({ path: `${SHOTS}/07-tv-live.png` });
    }

    // privacy: teammates & TV must not see it; judges must
    for (const g of guessers) assert(!(await g.page.locator('body').innerText()).includes(word), `${g.name} (guesser) cannot see the word`);
    assert(!(await tv.page.locator('body').innerText()).includes(word), 'TV display cannot see the word');
    assert((await judges[0].page.locator('.judge-card .word').innerText()).trim() === word, `${judges[0].name} (judge) sees the word to police it`);

    if (turn === 1) {
      // mark a few, a judge buzzes one, then let the clock run out
      await describer.page.getByRole('button', { name: /Got it/ }).click();
      await describer.page.waitForFunction((w) => document.querySelector('.word-card .word')?.textContent?.trim() !== w, word);
      await describer.page.getByRole('button', { name: /Got it/ }).click();
      await describer.page.waitForTimeout(150);
      await describer.page.getByRole('button', { name: /Skip/ }).click();
      await judges[0].page.waitForTimeout(300);
      await judges[0].page.getByRole('button', { name: /BUZZ/ }).click();
      await guessers[0].page.locator('.pip.foul').waitFor();
      assert(true, 'judge BUZZ is reflected on the guesser’s phone');

      // ---------- disconnect / reconnect mid-turn ----------
      const g = guessers[0];
      await g.ctx.setOffline(true);
      await host.page.waitForTimeout(400);
      await g.page.evaluate(() => window.dispatchEvent(new Event('offline')));
      // server-side detection: TV shows this player as asleep after socket closes; force close by reloading offline
      await g.page.reload().catch(() => {});
      await g.page.waitForTimeout(800);
      await g.ctx.setOffline(false);
      await g.page.reload();
      await g.page.locator('main.phase-turn-live').waitFor({ timeout: 8000 });
      assert((await g.page.locator('main.room').getAttribute('class')).includes('role-guesser'), `${g.name} reconnected into the same seat (still a guesser, same team)`);

      // describer reloads mid-turn and gets their card back
      await describer.page.reload();
      await describer.page.locator('.word-card .word').waitFor({ timeout: 8000 });
      assert(true, 'describer reloaded mid-turn and got the live card back');

      log('  letting the 30s clock run out…');
      await host.page.waitForSelector('main.phase-turn-review', { timeout: 40_000 });
      didTimeout = true;
      assert(true, 'turn ended on the server clock');
      const reveal = await host.page.locator('.reveal-list li').count();
      assert(reveal >= 5, `review reveals the words played (${reveal})`);
      assert((await tv.page.locator('.reveal-list').innerText()).includes(word), 'TV reveals words after the turn');
      await tv.page.screenshot({ path: `${SHOTS}/08-tv-review.png` });
      // describer flips a mis-tap (skip → correct)
      const skipItem = describer.page.locator('.reveal-list li.skip button').first();
      await skipItem.click();
      await describer.page.waitForTimeout(200);
      await describer.page.screenshot({ path: `${SHOTS}/09-review-phone.png` });
      didReconnect = true;
    } else {
      // sweep: mark everything correct quickly (exercises zero-friction advancing)
      for (let i = 0; i < 10; i++) {
        if (await describer.page.locator('main.phase-turn-review').count()) break;
        const before = await describer.page.locator('.word-card .word').innerText().catch(() => '');
        await describer.page.keyboard.press('ArrowRight').catch(() => {});
        if (i < 9) await describer.page.waitForFunction((w) => !document.querySelector('.word-card .word') || document.querySelector('.word-card .word').textContent !== w, before, { timeout: 3000 }).catch(() => {});
      }
      await host.page.waitForSelector('main.phase-turn-review');
      const pts = await host.page.locator('.big-points').innerText();
      assert(pts === '+13', `clean sweep scores 10 + 3 bonus (${pts})`);
    }
    // a teammate banks the points
    const banker = guessers[0];
    await banker.page.getByRole('button', { name: /Bank it|final results/ }).click();
  }

  assert(turn === 6, `3v2 → each team gets 3 turns (${turn} total)`);
  assert(didTimeout && didReconnect, 'timer + reconnect paths were exercised');
  assert(new Set(seenWords).size === seenWords.length, 'no repeated words across turns');

  await host.page.locator('.winner-title').waitFor();
  const title = await host.page.locator('.winner-title').innerText();
  const tvTitle = await tv.page.locator('.winner-title').innerText();
  log('final:', title);
  assert(title === tvTitle, 'phones and TV agree on the winner');
  await host.page.waitForTimeout(1500);
  await host.page.screenshot({ path: `${SHOTS}/10-final-phone.png`, fullPage: true });
  await tv.page.screenshot({ path: `${SHOTS}/11-tv-final.png` });
  const scores = await tv.page.locator('.step-score').allInnerTexts();
  log('scores:', scores.join(' / '));

  // secrecy audit over every frame the TV ever received while turns were live
  const states = tvFrames.map((f) => JSON.parse(f)).filter((m) => m.t === 'state');
  const liveStates = states.filter((m) => m.view.phase === 'turn-live');
  const leaked = states.filter((m) => m.view.turn?.card || (m.view.phase !== 'turn-review' && m.view.turn?.revealed));
  assert(liveStates.length > 20 && leaked.length === 0, `TV got ${liveStates.length} live-turn states over the wire; none carried a secret card`);

  // rematch
  await host.page.getByRole('button', { name: /Rematch/ }).click();
  await host.page.waitForSelector('main.phase-turn-ready');
  const reset = await host.page.locator('.mini-scores span').allInnerTexts();
  assert(reset.every((s) => s === '0'), 'rematch resets scores and starts turn 1');
  await tv.page.screenshot({ path: `${SHOTS}/12-tv-rematch.png` });

  // persistence: restart-safe snapshot written
  await host.page.waitForTimeout(2500);
  assert(fs.existsSync(dataFile) && fs.readFileSync(dataFile, 'utf8').includes(code), 'room snapshot persisted to disk');

  console.log('\nALL GOOD ✅');
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser.close();
  server.kill();
  process.exit(failed ? 1 : 0);
}
