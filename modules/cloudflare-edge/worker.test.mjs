// Run with `node --test modules/cloudflare-edge/worker.test.mjs` (CI does). Only worker.js is
// uploaded to Cloudflare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upstreamUrl } from './worker.js';

const FUNCTION_URL = 'https://abc123.lambda-url.us-east-1.on.aws/';

test('keeps path and query on the Function URL host', () => {
  const target = upstreamUrl('https://power.example.com/api/status?x=1', FUNCTION_URL);
  assert.equal(target.href, 'https://abc123.lambda-url.us-east-1.on.aws/api/status?x=1');
});

for (const path of ['//evil.com/x', '/\\evil.com/x']) {
  test(`path ${path} stays on the Function URL host`, () => {
    const target = upstreamUrl(`https://power.example.com${path}`, FUNCTION_URL);
    assert.equal(target.origin, 'https://abc123.lambda-url.us-east-1.on.aws');
  });
}
