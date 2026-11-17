import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const SERVE = fileURLToPath(new URL('../dev/serve.mjs', import.meta.url));

// Starts dev/serve.mjs and resolves with its first stdout line (it is listening by then), or
// with the exit code if it dies first.
async function startServe(env) {
  const child = spawn(process.execPath, [SERVE], { env: { ...process.env, POWER_SWITCH_DEV_HOST: '', ...env } });
  const line = await Promise.race([
    once(child.stdout, 'data').then(([chunk]) => chunk.toString()),
    once(child, 'exit').then(([code]) => `serve.mjs exited with ${code}`),
  ]);
  return { child, line };
}

test('dev/serve.mjs listens on 127.0.0.1 only by default, ignoring a generic HOST', async (t) => {
  const port = String(20000 + Math.floor(Math.random() * 20000));
  // Some shells (tcsh) export HOST as the machine name; it must not widen the bind.
  const { child, line } = await startServe({ PORT: port, HOST: '0.0.0.0' });
  t.after(() => child.kill());
  // serve.mjs prints server.address().address, the address it is actually bound to.
  assert.match(line, /listening on 127\.0\.0\.1\)/);
  const response = await fetch(`http://127.0.0.1:${port}/api/resources`);
  assert.equal(response.status, 200);
});
