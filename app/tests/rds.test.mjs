import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The AWS SDK ships with the Lambda runtime and is not installed for the tests, so a resolve hook
// swaps '@aws-sdk/client-rds' for command classes that only keep their input.
const dataUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const sdkStub = dataUrl(`
  class Command { constructor(input) { this.input = input; } }
  export class DescribeDBInstancesCommand extends Command {}
  export class DescribeEventsCommand extends Command {}
  export class StartDBInstanceCommand extends Command {}
  export class StopDBInstanceCommand extends Command {}
`);
register(dataUrl(`
  export function resolve(specifier, context, nextResolve) {
    if (specifier === '@aws-sdk/client-rds') return { url: ${JSON.stringify(sdkStub)}, shortCircuit: true };
    return nextResolve(specifier, context);
  }
`));
const { createRdsAdapter } = await import('../rds.mjs');

const TAG = 'power-switch';

// A fake RDS client that answers DescribeDBInstances with one page of `dbInstances`. When
// `eventLookups` is given, it also answers DescribeEvents with no events and records each input.
function fakeClient(dbInstances, eventLookups) {
  return {
    async send(command) {
      if (eventLookups && command.constructor.name === 'DescribeEventsCommand') {
        eventLookups.push(command.input);
        return { Events: [] };
      }
      assert.equal(command.constructor.name, 'DescribeDBInstancesCommand');
      return { DBInstances: dbInstances };
    },
  };
}

test('lists a plain DB instance with its id, name, state and tags', async () => {
  const rds = createRdsAdapter(fakeClient([
    {
      DBInstanceIdentifier: 'example-db',
      DBInstanceStatus: 'available',
      TagList: [{ Key: TAG, Value: 'analytics' }, { Key: 'Name', Value: 'Example DB' }],
    },
  ]));
  assert.deepEqual(await rds.listInstances(), [
    { id: 'example-db', name: 'Example DB', state: 'available', tags: { [TAG]: 'analytics', Name: 'Example DB' } },
  ]);
});

test('leaves out a DB instance that belongs to a cluster', async () => {
  const rds = createRdsAdapter(fakeClient([
    { DBInstanceIdentifier: 'plain-db', DBInstanceStatus: 'available', TagList: [{ Key: TAG, Value: '' }] },
    {
      DBInstanceIdentifier: 'cluster-member',
      DBClusterIdentifier: 'example-cluster',
      DBInstanceStatus: 'available',
      TagList: [{ Key: TAG, Value: '' }],
    },
  ]));
  assert.deepEqual((await rds.listInstances()).map((instance) => instance.id), ['plain-db']);
});

test('looks up the stop time only for a stopped DB instance that carries the tag key', async () => {
  const eventLookups = [];
  const rds = createRdsAdapter(fakeClient([
    { DBInstanceIdentifier: 'tagged-db', DBInstanceStatus: 'stopped', TagList: [{ Key: TAG, Value: '' }] },
    { DBInstanceIdentifier: 'untagged-db', DBInstanceStatus: 'stopped', TagList: [{ Key: 'Name', Value: 'Other' }] },
  ], eventLookups), TAG);
  await rds.listInstances();
  assert.deepEqual(eventLookups.map((input) => input.SourceIdentifier), ['tagged-db']);
});
