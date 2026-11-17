import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../handler.mjs';
import { createAccessVerifier } from '../access.mjs';
import { createResources } from '../resources.mjs';
import { sampleEc2, sampleRds } from '../dev/fakes.mjs';
import { createSigner, TEAM_DOMAIN, AUD, NOW_MS } from './tokens.mjs';

const signer = createSigner();
const silentLog = { info() {}, warn() {}, error() {} };
const ORIGIN = 'https://power.example.com';

function setup(log = silentLog) {
  const ec2 = sampleEc2();
  const rds = sampleRds();
  const handle = createHandler({
    verifyAccessToken: createAccessVerifier({
      teamDomain: TEAM_DOMAIN, aud: AUD, now: () => NOW_MS, fetchKeys: async () => [signer.jwk],
    }),
    resources: createResources({ ec2, rds, tagKey: 'power-switch' }),
    page: '<html>page</html>',
    allowedOrigin: ORIGIN,
    log,
  });
  return { handle, ec2, rds };
}

// Defaults to what a browser sends from the power page itself.
function request(method, path, token = signer.token(), fetchHeaders = { 'sec-fetch-site': 'same-origin' }) {
  const headers = { ...fetchHeaders, ...(token ? { 'cf-access-jwt-assertion': token } : {}) };
  return { rawPath: path, requestContext: { http: { method } }, headers };
}

test('every route returns 401 without a valid Access token', async () => {
  const { handle, ec2 } = setup();
  for (const [method, path] of [['GET', '/'], ['GET', '/api/resources'], ['POST', '/api/resources/ec2/i-0node/stop'], ['GET', '/nope']]) {
    assert.equal((await handle(request(method, path, null))).statusCode, 401, `${method} ${path}`);
    assert.equal((await handle(request(method, path, createSigner().token()))).statusCode, 401, `${method} ${path}`);
  }
  assert.deepEqual(ec2.calls, []);
});

test('GET / serves the page', async () => {
  const { handle } = setup();
  const response = await handle(request('GET', '/'));
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.equal(response.body, '<html>page</html>');
});

test('GET /api/resources lists tagged resources', async () => {
  const { handle } = setup();
  const response = await handle(request('GET', '/api/resources'));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body).resources.map((r) => r.id), ['example-db', 'i-0node']);
});

test('POST start/stop acts on the tagged resource', async () => {
  const { handle, ec2, rds } = setup();
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0node/stop'))).statusCode, 202);
  assert.equal((await handle(request('POST', '/api/resources/rds/example-db/start'))).statusCode, 202);
  assert.deepEqual(ec2.calls, [['stop', 'i-0node']]);
  assert.deepEqual(rds.calls, [['start', 'example-db']]);
});

test('POST on an untagged ID returns 404 and does nothing', async () => {
  const { handle, ec2 } = setup();
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0other/stop'))).statusCode, 404);
  assert.deepEqual(ec2.calls, []);
});

test('unknown routes, types, actions and methods return 404', async () => {
  const { handle } = setup();
  for (const [method, path] of [
    ['GET', '/nope'],
    ['POST', '/api/resources/s3/bucket/stop'],
    ['POST', '/api/resources/ec2/i-0node/reboot'],
    ['GET', '/api/resources/ec2/i-0node/stop'],
    ['POST', '/api/resources'],
  ]) {
    assert.equal((await handle(request(method, path))).statusCode, 404, `${method} ${path}`);
  }
});

test('POST start/stop from another origin returns 403 and does nothing', async () => {
  const { handle, ec2 } = setup();
  const crossOrigin = [
    { 'sec-fetch-site': 'same-site', origin: 'https://admin.example.com' },
    { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' },
    {},
  ];
  for (const fetchHeaders of crossOrigin) {
    const response = await handle(request('POST', '/api/resources/ec2/i-0node/stop', signer.token(), fetchHeaders));
    assert.equal(response.statusCode, 403, JSON.stringify(fetchHeaders));
  }
  assert.deepEqual(ec2.calls, []);
});

test('POST with an Origin equal to the power page is allowed', async () => {
  const { handle, ec2 } = setup();
  const response = await handle(request('POST', '/api/resources/ec2/i-0node/stop', signer.token(), { origin: ORIGIN }));
  assert.equal(response.statusCode, 202);
  assert.deepEqual(ec2.calls, [['stop', 'i-0node']]);
});

test('an AWS failure returns 502', async () => {
  const handle = createHandler({
    verifyAccessToken: async () => ({}),
    resources: { list: async () => { throw new Error('throttled'); } },
    page: '',
    log: silentLog,
  });
  const response = await handle(request('GET', '/api/resources'));
  assert.equal(response.statusCode, 502);
});

// Records every log call as [level, ...args].
function recordingLog() {
  const lines = [];
  const record = (level) => (...args) => lines.push([level, ...args]);
  return { lines, info: record('info'), warn: record('warn'), error: record('error') };
}

function failingHandler(error, log = silentLog) {
  return createHandler({
    verifyAccessToken: async () => ({}),
    resources: { list: async () => { throw error; } },
    page: '',
    log,
  });
}

test('no response can be framed: page, JSON, errors', async () => {
  const { handle } = setup();
  const responses = [
    await handle(request('GET', '/')),
    await handle(request('GET', '/api/resources')),
    await handle(request('POST', '/api/resources/ec2/i-0node/stop')),
    await handle(request('GET', '/nope')),
    await handle(request('GET', '/', null)),
    await handle(request('POST', '/api/resources/ec2/i-0node/stop', signer.token(), {})),
    await handle(request('POST', '/api/resources/ec2/%zz/stop')),
    await failingHandler(new Error('boom'))(request('GET', '/api/resources')),
  ];
  for (const response of responses) {
    assert.equal(response.headers['content-security-policy'], "frame-ancestors 'none'", String(response.statusCode));
    assert.equal(response.headers['x-frame-options'], 'DENY', String(response.statusCode));
  }
});

// The audit line written for one request, as parsed JSON.
function auditEntry(action, type, id, outcome, { email = 'admin@example.com', sub = 'user-1' } = {}) {
  return { audit: 'power-switch', email, sub, action, type, id, outcome };
}

test('an accepted start/stop logs requested then accepted with the verified identity, never the token', async () => {
  const log = recordingLog();
  const { handle } = setup(log);
  const identity = { email: 'ops@example.com', sub: 'user-42' };
  const token = signer.token(identity);
  await handle(request('POST', '/api/resources/ec2/i-0node/stop', token));
  await handle(request('POST', '/api/resources/rds/example-db/start', token));

  const info = log.lines.filter(([level]) => level === 'info');
  assert.deepEqual(info.map(([, line]) => JSON.parse(line)), [
    auditEntry('stop', 'ec2', 'i-0node', 'requested', identity),
    auditEntry('stop', 'ec2', 'i-0node', 'accepted', identity),
    auditEntry('start', 'rds', 'example-db', 'requested', identity),
    auditEntry('start', 'rds', 'example-db', 'accepted', identity),
  ]);
  for (const line of log.lines) assert.ok(!JSON.stringify(line).includes(token.split('.')[2]), 'token logged');
});

test('a start/stop on an untagged id is audited as requested then refused', async () => {
  const log = recordingLog();
  const { handle } = setup(log);
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0other/stop'))).statusCode, 404);
  assert.deepEqual(log.lines.map(([level, line]) => [level, JSON.parse(line)]), [
    ['info', auditEntry('stop', 'ec2', 'i-0other', 'requested')],
    ['info', auditEntry('stop', 'ec2', 'i-0other', 'refused')],
  ]);
});

// A handler whose stop() records itself in the log, so tests can see where the AWS call falls
// between the audit lines. failWith: the error stop() throws, if any.
function orderRecordingHandler(log, failWith) {
  return createHandler({
    verifyAccessToken: async () => ({ email: 'admin@example.com', sub: 'user-1' }),
    resources: {
      stop: async () => {
        log.lines.push(['aws', 'stop']);
        if (failWith) throw failWith;
      },
    },
    page: '',
    allowedOrigin: ORIGIN,
    log,
  });
}

// Each log entry as [level, outcome] for audit lines, unchanged otherwise.
function trail(lines) {
  return lines.map(([level, line]) => (level === 'info' ? [level, JSON.parse(line).outcome] : [level, line]));
}

test('the requested line is logged before the AWS call and the outcome after it', async () => {
  const log = recordingLog();
  assert.equal((await orderRecordingHandler(log)(request('POST', '/api/resources/ec2/i-0node/stop'))).statusCode, 202);
  assert.deepEqual(trail(log.lines), [['info', 'requested'], ['aws', 'stop'], ['info', 'accepted']]);
});

test('a start/stop that AWS fails is audited as requested then failed, without the error text', async () => {
  const log = recordingLog();
  const error = new Error('arn:aws:ec2:eu-west-1:123456789012:instance/i-0node');
  assert.equal((await orderRecordingHandler(log, error)(request('POST', '/api/resources/ec2/i-0node/stop'))).statusCode, 502);
  assert.deepEqual(trail(log.lines), [['info', 'requested'], ['aws', 'stop'], ['info', 'failed'], ['error', error]]);
  const audits = log.lines.filter(([level]) => level === 'info').map(([, line]) => JSON.parse(line));
  assert.deepEqual(audits, [auditEntry('stop', 'ec2', 'i-0node', 'requested'), auditEntry('stop', 'ec2', 'i-0node', 'failed')]);
});

test('reads and refused requests write no audit line', async () => {
  const log = recordingLog();
  const { handle } = setup(log);
  await handle(request('GET', '/'));
  await handle(request('GET', '/api/resources'));
  await handle(request('POST', '/api/resources/ec2/i-0node/stop', null));
  await handle(request('POST', '/api/resources/ec2/i-0node/stop', signer.token(), {}));
  assert.deepEqual(log.lines.filter(([level]) => level === 'info'), []);
});

test('a 502 hides the AWS error text and logs it server-side', async () => {
  const log = recordingLog();
  const error = new Error('User: arn:aws:sts::123456789012:assumed-role/x is not authorized');
  const response = await failingHandler(error, log)(request('GET', '/api/resources'));
  assert.equal(response.statusCode, 502);
  assert.deepEqual(JSON.parse(response.body), { error: 'Upstream error' });
  assert.deepEqual(log.lines, [['error', error]]);
});

test('a malformed %-escape in the id returns 400 and does nothing', async () => {
  const { handle, ec2 } = setup();
  for (const id of ['%', '%zz', 'i-0node%', '%E0%A4%A', '%C0']) {
    const response = await handle(request('POST', `/api/resources/ec2/${id}/stop`));
    assert.equal(response.statusCode, 400, id);
    assert.deepEqual(JSON.parse(response.body), { error: 'Bad request' }, id);
  }
  assert.deepEqual(ec2.calls, []);
});

test('a well-formed %-escaped id is decoded', async () => {
  const { handle, ec2 } = setup();
  assert.equal((await handle(request('POST', '/api/resources/ec2/i-0n%6Fde/stop'))).statusCode, 202);
  assert.deepEqual(ec2.calls, [['stop', 'i-0node']]);
});

test('a malformed id still needs Access and the same origin first', async () => {
  const { handle } = setup();
  assert.equal((await handle(request('POST', '/api/resources/ec2/%zz/stop', null))).statusCode, 401);
  assert.equal((await handle(request('POST', '/api/resources/ec2/%zz/stop', signer.token(), {}))).statusCode, 403);
});
