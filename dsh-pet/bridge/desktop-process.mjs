/** Owns only the standalone child created by this coordinator. */
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root, port, dataDir, nodeCommand, dshHome, electronPath } from './runtime.mjs';
export class DesktopProcess {
  constructor({ launch = true } = {}) {
    this.launch = launch;
    this.child = null;
    this.error = null;
    this.stopping = null;
  }
  snapshot() {
    return {
      pid: this.child?.pid || null,
      state: this.error ? 'error' : this.child ? 'starting-or-running' : 'stopped',
      error: this.error,
    };
  }
  start() {
    if (this.child || !this.launch || this.stopping) return;
    this.error = null;
    mkdirSync(path.join(dshHome, 'dsh-pet'), { recursive: true });
    const file = path.join(dshHome, 'dsh-pet/main-config.jsonc');
    if (!existsSync(file))
      writeFileSync(
        file,
        JSON.stringify(
          {
            pets: [
              {
                id: 'main',
                name: 'ChatGPT 娘',
                size: 380,
                display: 'desktop',
                balanceEnabled: true,
                whisperEnabled: false,
                workStatusEnabled: true,
                fixedEnabled: false,
                position: { corner: 'bottom-right', marginX: 24, marginY: 36 },
              },
            ],
            notificationsEnabled: false,
          },
          null,
          2,
        ),
      );
    const characters = path.join(dshHome, 'dsh-pet/characters.json');
    if (!existsSync(characters)) writeFileSync(characters, JSON.stringify({ main: 'chatgpt' }));
    const child = spawn(nodeCommand(), [path.join(root, 'lib/standalone.js'), '--port', String(port + 1)], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DSH_HOME: dshHome,
        DSH_PET_ELECTRON_PATH: process.env.DSH_PET_ELECTRON_PATH || electronPath,
        PET_DATA_DIR: dataDir,
        PET_PORT: String(port),
        PET_HOST_SOURCE: 'chatgpt',
        ELECTRON_RUN_AS_NODE: '1',
      },
    });
    this.child = child;
    child.stdout.on('data', (b) => process.stderr.write(b));
    child.stderr.on('data', (b) => process.stderr.write(b));
    child.on('error', (error) => {
      this.error = error.message;
      if (this.child === child) this.child = null;
    });
    child.on('exit', (code) => {
      if (this.child === child) {
        this.child = null;
        if (!this.stopping) this.error = 'Desktop host exited: ' + code;
      }
    });
  }
  stop() {
    if (this.stopping) return this.stopping;
    const child = this.child;
    if (!child) return Promise.resolve();
    this.stopping = new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill();
    }).finally(() => {
      if (this.child === child) this.child = null;
      this.stopping = null;
    });
    return this.stopping;
  }
}
