import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('short-lived CLI waits for bridge status and releases its keepalive', () => {
  const client = new URL('../dsh-pet/bridge/client.mjs', import.meta.url).href;
  const code = `
    const c = await import(${JSON.stringify(client)});
    globalThis.fetch = () => new Promise(resolve => {
      setTimeout(() => resolve({ok:true, json:async () => ({service:'desktop-pet',version:1,build:'99.0.0'})}), 50).unref();
    });
    console.log(JSON.stringify(await c.ensureBridge()));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).build, '99.0.0');
});
