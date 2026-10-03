import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import { RoomHub, type Snapshot } from '../shared/hub';
import type { ClientMsg } from '../shared/types';

/** Node adapter: WebSockets in, JSON snapshot on disk for restart safety. */
export class RoomManager extends RoomHub {
  constructor(private dataFile: string | null) {
    super();
    if (dataFile && fs.existsSync(dataFile)) {
      try {
        const snaps = JSON.parse(fs.readFileSync(dataFile, 'utf8')) as Snapshot[];
        this.restore(snaps);
        console.log(`[rooms] restored ${snaps.length} room(s)`);
      } catch (e) {
        console.warn('[rooms] could not restore snapshot', e);
      }
    }
    setInterval(() => this.flush(), 2000).unref();
  }

  flush() {
    if (!this.dataFile || !this.dirty) return;
    this.dirty = false;
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = this.dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.snapshot()));
    fs.renameSync(tmp, this.dataFile);
  }

  attach(ws: WebSocket) {
    const h = this.connect({
      send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)),
      close: () => ws.close(),
    });
    ws.on('message', (buf) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      h.message(msg);
    });
    ws.on('close', h.close);
  }
}
