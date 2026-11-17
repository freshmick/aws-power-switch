import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin } from '../origin.mjs';

const ORIGIN = 'https://power.example.com';

test('accepts Sec-Fetch-Site: same-origin', () => {
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'same-origin' }, ORIGIN), true);
});

test('accepts an Origin equal to the power hostname', () => {
  assert.equal(isSameOrigin({ origin: ORIGIN }, ORIGIN), true);
});

test('rejects same-site and cross-site requests', () => {
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'same-site', origin: 'https://admin.example.com' }, ORIGIN), false);
  assert.equal(isSameOrigin({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' }, ORIGIN), false);
});

test('rejects a request with neither header', () => {
  assert.equal(isSameOrigin({}, ORIGIN), false);
});
