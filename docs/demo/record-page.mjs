// Records docs/demo/page.gif: the power switch page, served by the local dev server (sample data
// only, no AWS), while a group is started and its instance stopped again. How to run it: see README.md in this folder.
//
// playwright-core is resolved from the directory you run this from, so the repo gains no dependency.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const serverScript = join(here, '../../app/dev/serve.mjs');
const output = join(here, 'page.gif');
const port = process.env.PORT || '8799';
const group = 'demo';
const lastGroupInFrame = 'docs';
const WIDTH = 800;
const FRAME_PADDING = 12;
const GIF_WIDTH = 1080;

const { chromium } = createRequire(join(process.cwd(), 'noop.js'))('playwright-core');

function startServer() {
  const server = spawn(process.execPath, [serverScript], { env: { ...process.env, PORT: port, TZ: 'UTC' } });
  const ready = new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('exit', (code) => reject(new Error(`dev server exited with ${code}`)));
  });
  return { server, ready };
}

// A drawn pointer, since a headless browser has none. It lives in the recording only.
async function addPointer(page) {
  await page.evaluate(() => {
    const pointer = document.createElement('div');
    pointer.id = 'demo-pointer';
    pointer.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l14 8-6 1.5L8.5 18z" fill="#1a1a1a" stroke="#fff" stroke-width="1.5"/></svg>';
    pointer.style.cssText = 'position:fixed;left:560px;top:240px;z-index:9;pointer-events:none;transition:transform .1s';
    document.body.append(pointer);
  });
}

function createFilm(page, dir) {
  const frames = [];
  async function shot(ms) {
    const file = join(dir, `${String(frames.length).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    frames.push({ file, ms });
  }
  async function movePointer(target) {
    const box = await target.boundingBox();
    const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const from = await page.evaluate(() => {
      const { left, top } = document.getElementById('demo-pointer').style;
      return { x: parseFloat(left), y: parseFloat(top) };
    });
    const steps = 10;
    for (let step = 1; step <= steps; step += 1) {
      const eased = (1 - Math.cos((Math.PI * step) / steps)) / 2;
      const at = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
      await page.evaluate(({ x, y }) => {
        Object.assign(document.getElementById('demo-pointer').style, { left: `${x}px`, top: `${y}px` });
      }, at);
      await shot(40);
    }
  }
  async function click(target) {
    await movePointer(target);
    await shot(350);
    await page.evaluate(() => { document.getElementById('demo-pointer').style.transform = 'scale(0.8)'; });
    await shot(120);
    await target.click();
    await page.evaluate(() => { document.getElementById('demo-pointer').style.transform = ''; });
  }
  return { frames, shot, click };
}

const groupSection = (page, name) => page.locator('section', { has: page.getByRole('heading', { name, exact: true }) });

// Shrinks the window so the frame ends just under the last group to show.
async function frameDownTo(page, section) {
  const box = await section.boundingBox();
  await page.setViewportSize({ width: WIDTH, height: Math.ceil(box.y + box.height) + FRAME_PADDING });
}

async function record(page, film) {
  await page.goto(`http://localhost:${port}/`);
  const section = groupSection(page, group);
  const instanceRow = section.locator('tr', { hasText: 'EC2 instance' });
  await section.waitFor();
  await frameDownTo(page, groupSection(page, lastGroupInFrame));
  await addPointer(page);
  await film.shot(1800);

  await film.click(section.getByRole('button', { name: 'Start all' }));
  await instanceRow.locator('td.state', { hasText: 'running' }).waitFor();
  await film.shot(2600);

  await film.click(instanceRow.getByRole('button', { name: 'Stop', exact: true }));
  await instanceRow.locator('td.state', { hasText: 'stopped' }).waitFor();
  await film.shot(3000);
}

function writeGif(frames, dir) {
  const list = join(dir, 'frames.txt');
  const lines = frames.flatMap(({ file, ms }) => [`file '${file}'`, `duration ${ms / 1000}`]);
  // The concat demuxer ignores the last duration unless the last frame is listed twice.
  writeFileSync(list, [...lines, `file '${frames.at(-1).file}'`].join('\n'));
  const filter = `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=none`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-fps_mode', 'vfr', '-filter_complex', filter, '-loop', '0', output]);
}

const dir = mkdtempSync(join(tmpdir(), 'power-switch-demo-'));
const { server, ready } = startServer();
let browser;
try {
  await ready;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 600 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();
  const film = createFilm(page, dir);
  await record(page, film);
  writeGif(film.frames, dir);
  console.log(`Wrote ${output} (${film.frames.length} frames)`);
} finally {
  await browser?.close();
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}
