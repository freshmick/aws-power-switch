import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResources, NotFoundError } from '../resources.mjs';
import { createFakeAdapter, sampleEc2, sampleRds } from '../dev/fakes.mjs';

const TAG = 'power-switch';

test('lists only tagged instances, RDS first, with normalised state', async () => {
  const resources = createResources({ ec2: sampleEc2(), rds: sampleRds(), tagKey: TAG });
  assert.deepEqual(await resources.list(), [
    { type: 'rds', id: 'example-db', name: 'example-db', state: 'running', group: 'true' },
    { type: 'ec2', id: 'i-0node', name: 'example-instance', state: 'running', group: 'true' },
  ]);
});

test('uses the configured tag key', async () => {
  const resources = createResources({ ec2: sampleEc2(), rds: sampleRds(), tagKey: 'Name' });
  assert.deepEqual((await resources.list()).map((r) => r.id), ['i-0node', 'i-0other']);
});

test('maps EC2 pending/stopping to starting/stopping', async () => {
  const ec2 = createFakeAdapter([
    { id: 'a', state: 'pending', tags: { [TAG]: '' } },
    { id: 'b', state: 'stopping', tags: { [TAG]: '' } },
  ]);
  const resources = createResources({ ec2, rds: createFakeAdapter([]), tagKey: TAG });
  assert.deepEqual((await resources.list()).map((r) => r.state), ['starting', 'stopping']);
});

test('a stopped RDS instance shows when AWS starts it again (7 days after stopping)', async () => {
  const rds = createFakeAdapter([
    { id: 'db', state: 'stopped', stoppedAt: new Date('2026-10-01T10:00:00Z'), tags: { [TAG]: '' } },
    { id: 'db-unknown', state: 'stopped', tags: { [TAG]: '' } },
  ]);
  const resources = createResources({ ec2: createFakeAdapter([]), rds, tagKey: TAG });
  const [known, unknown] = await resources.list();
  assert.equal(known.autoStartAt, '2026-10-08T10:00:00.000Z');
  assert.equal(unknown.autoStartAt, null);
});

test('starts and stops tagged instances', async () => {
  const ec2 = sampleEc2();
  const rds = sampleRds();
  const resources = createResources({ ec2, rds, tagKey: TAG });
  await resources.stop('ec2', 'i-0node');
  await resources.start('rds', 'example-db');
  assert.deepEqual(ec2.calls, [['stop', 'i-0node']]);
  assert.deepEqual(rds.calls, [['start', 'example-db']]);
});

test('refuses untagged, unknown and wrong-type IDs without calling AWS', async () => {
  const ec2 = sampleEc2();
  const rds = sampleRds();
  const resources = createResources({ ec2, rds, tagKey: TAG });
  await assert.rejects(resources.stop('ec2', 'i-0other'), NotFoundError);
  await assert.rejects(resources.stop('rds', 'other-db'), NotFoundError);
  await assert.rejects(resources.start('ec2', 'i-missing'), NotFoundError);
  await assert.rejects(resources.start('rds', 'i-0node'), NotFoundError);
  await assert.rejects(resources.start('s3', 'bucket'), NotFoundError);
  assert.deepEqual([...ec2.calls, ...rds.calls], []);
});
