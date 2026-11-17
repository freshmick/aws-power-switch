import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGE = readFileSync(new URL('../page.html', import.meta.url), 'utf8');

// The page must read the same for any install: an EC2 instance is an "instance", never a "node".
test('the page text contains no "node"', () => {
  assert.doesNotMatch(PAGE, /node/i);
});
