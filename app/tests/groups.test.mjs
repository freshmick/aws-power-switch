// GET /api/resources returns each resource's group: the value of the configured tag key.
// Tested at the handler seam with fake EC2/RDS adapters and a real Access token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../handler.mjs';
import { createAccessVerifier } from '../access.mjs';
import { createResources } from '../resources.mjs';
import { createFakeAdapter } from '../dev/fakes.mjs';
import { createSigner, TEAM_DOMAIN, AUD, NOW_MS } from './tokens.mjs';

const signer = createSigner();
const ORIGIN = 'https://power.example.com';
const silentLog = { info() {}, warn() {}, error() {} };

function setup({ ec2Instances = [], rdsInstances = [], tagKey = 'power-switch' }) {
  const ec2 = createFakeAdapter(ec2Instances);
  const rds = createFakeAdapter(rdsInstances, { runningState: 'available' });
  const handle = createHandler({
    verifyAccessToken: createAccessVerifier({
      teamDomain: TEAM_DOMAIN, aud: AUD, now: () => NOW_MS, fetchKeys: async () => [signer.jwk],
    }),
    resources: createResources({ ec2, rds, tagKey }),
    page: '',
    allowedOrigin: ORIGIN,
    log: silentLog,
  });
  return { handle, ec2, rds };
}

function request(method, path) {
  return {
    rawPath: path,
    requestContext: { http: { method } },
    headers: { 'cf-access-jwt-assertion': signer.token(), 'sec-fetch-site': 'same-origin' },
  };
}

async function listGroups(handle) {
  const response = await handle(request('GET', '/api/resources'));
  assert.equal(response.statusCode, 200);
  return Object.fromEntries(JSON.parse(response.body).resources.map((r) => [r.id, r.group]));
}

test('each resource comes back with its tag value as its group', async () => {
  const { handle } = setup({
    ec2Instances: [{ id: 'i-0docs', state: 'running', tags: { 'power-switch': 'docs' } }],
    rdsInstances: [{ id: 'demo-database', state: 'available', tags: { 'power-switch': 'demo' } }],
  });
  assert.deepEqual(await listGroups(handle), { 'i-0docs': 'docs', 'demo-database': 'demo' });
});

test('an empty tag value gives an empty group', async () => {
  const { handle } = setup({
    ec2Instances: [{ id: 'i-0bare', state: 'running', tags: { 'power-switch': '' } }],
  });
  assert.deepEqual(await listGroups(handle), { 'i-0bare': '' });
});

test('the group is read from a custom tag key', async () => {
  const { handle } = setup({
    tagKey: 'switch',
    ec2Instances: [{ id: 'i-0docs', state: 'running', tags: { switch: 'docs', 'power-switch': 'demo' } }],
  });
  assert.deepEqual(await listGroups(handle), { 'i-0docs': 'docs' });
});

test('only EC2 and RDS resources are listed', async () => {
  const { handle } = setup({
    ec2Instances: [{ id: 'i-0docs', state: 'running', tags: { 'power-switch': 'docs' } }],
    rdsInstances: [{ id: 'demo-database', state: 'available', tags: { 'power-switch': 'demo' } }],
  });
  const response = await handle(request('GET', '/api/resources'));
  const types = new Set(JSON.parse(response.body).resources.map((r) => r.type));
  assert.deepEqual([...types].sort(), ['ec2', 'rds']);
});

test('a POST for any other type returns 404 without calling an adapter', async () => {
  const { handle, ec2, rds } = setup({
    ec2Instances: [{ id: 'i-0docs', state: 'running', tags: { 'power-switch': 'docs' } }],
    rdsInstances: [{ id: 'demo-database', state: 'available', tags: { 'power-switch': 'demo' } }],
  });
  for (const type of ['s3', 'ecs', 'lambda', 'EC2']) {
    const response = await handle(request('POST', `/api/resources/${type}/i-0docs/start`));
    assert.equal(response.statusCode, 404, type);
  }
  assert.deepEqual([...ec2.calls, ...rds.calls], []);
});

test('start/stop checks the tag key only; the value plays no part', async () => {
  const { handle, ec2 } = setup({
    ec2Instances: [
      { id: 'i-0docs', state: 'running', tags: { 'power-switch': 'docs' } },
      { id: 'i-0bare', state: 'running', tags: { 'power-switch': '' } },
      { id: 'i-0none', state: 'running', tags: { other: 'docs' } },
    ],
  });
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0docs/stop'))).statusCode, 202);
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0bare/stop'))).statusCode, 202);
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0none/stop'))).statusCode, 404);
  assert.deepEqual(ec2.calls, [['stop', 'i-0docs'], ['stop', 'i-0bare']]);
});
