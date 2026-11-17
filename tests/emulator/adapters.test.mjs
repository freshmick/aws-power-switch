// Runs the real EC2, RDS and SSM adapters, with the real AWS SDK, against a local AWS Emulator.
// The tests in app/tests/ use in-memory fakes; these check the SDK calls themselves: the tag
// filter, start and stop, the state names, and the RDS stop event behind the auto-start date.
//
// The emulator does not evaluate IAM tag conditions the way AWS does, so nothing here tests IAM.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EC2Client, RunInstancesCommand } from '@aws-sdk/client-ec2';
import { RDSClient, CreateDBInstanceCommand } from '@aws-sdk/client-rds';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { createEc2Adapter } from '../../app/ec2.mjs';
import { createRdsAdapter } from '../../app/rds.mjs';
import { createParameterLoader } from '../../app/ssm.mjs';
import { createResources, NotFoundError } from '../../app/resources.mjs';
import { requireEmulator, waitFor } from './emulator.mjs';

requireEmulator();

const TAG = 'power-switch';
// The emulator keeps state until it stops, so each run uses its own names.
const run = randomUUID().slice(0, 8);
const taggedDb = `tagged-${run}`;
const untaggedDb = `untagged-${run}`;

const ec2Client = new EC2Client();
const rdsClient = new RDSClient();
const ssmClient = new SSMClient();
const ec2 = createEc2Adapter(ec2Client, TAG);
const rds = createRdsAdapter(rdsClient, TAG);
const resources = createResources({ ec2, rds, tagKey: TAG });

let taggedInstance;
let untaggedInstance;

const toTags = (tags) => Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

async function runInstance(tags) {
  const { Instances } = await ec2Client.send(new RunInstancesCommand({
    ImageId: 'ami-0123456789abcdef0',
    InstanceType: 't3.micro',
    MinCount: 1,
    MaxCount: 1,
    TagSpecifications: [{ ResourceType: 'instance', Tags: toTags(tags) }],
  }));
  return Instances[0].InstanceId;
}

async function createDb(id, tags) {
  await rdsClient.send(new CreateDBInstanceCommand({
    DBInstanceIdentifier: id,
    DBInstanceClass: 'db.t3.micro',
    Engine: 'postgres',
    AllocatedStorage: 20,
    MasterUsername: 'emulator',
    MasterUserPassword: randomUUID(),
    Tags: toTags(tags),
  }));
}

const ec2State = async (id) => (await ec2.listInstances()).find((instance) => instance.id === id)?.state;
const rdsInstance = async (id) => (await rds.listInstances()).find((instance) => instance.id === id);
const rdsState = async (id) => (await rdsInstance(id))?.state;

before(async () => {
  taggedInstance = await runInstance({ [TAG]: 'demo', Name: `tagged-${run}` });
  untaggedInstance = await runInstance({ Name: `untagged-${run}` });
  await createDb(taggedDb, { [TAG]: 'demo' });
  await createDb(untaggedDb, {});
  await waitFor(() => ec2State(taggedInstance), 'running');
  await waitFor(() => rdsState(taggedDb), 'available');
  await waitFor(() => rdsState(untaggedDb), 'available');
});

test('EC2: the tag filter lists the tagged instance and leaves out the untagged one', async () => {
  const instances = await ec2.listInstances();
  const tagged = instances.find((instance) => instance.id === taggedInstance);
  assert.equal(tagged.name, `tagged-${run}`);
  assert.equal(tagged.tags[TAG], 'demo');
  assert.equal(instances.some((instance) => instance.id === untaggedInstance), false);
});

test('EC2: stop then start moves the instance to stopped and back to running', async () => {
  await ec2.stop(taggedInstance);
  await waitFor(() => ec2State(taggedInstance), 'stopped');
  await ec2.start(taggedInstance);
  await waitFor(() => ec2State(taggedInstance), 'running');
});

test('RDS: instances are listed with their tags', async () => {
  assert.deepEqual((await rdsInstance(taggedDb)).tags, { [TAG]: 'demo' });
  assert.deepEqual((await rdsInstance(untaggedDb)).tags, {});
});

test('RDS: a stopped instance carries its stop time, and start brings it back', async () => {
  const before = Date.now();
  await rds.stop(taggedDb);
  await waitFor(() => rdsState(taggedDb), 'stopped');

  const { stoppedAt } = await rdsInstance(taggedDb);
  assert.ok(stoppedAt instanceof Date, 'the stop event was found');
  // A minute of slack for clock differences between the test and the emulator.
  assert.ok(Math.abs(stoppedAt.getTime() - before) < 60_000, `stop time ${stoppedAt.toISOString()} is recent`);

  await rds.start(taggedDb);
  await waitFor(() => rdsState(taggedDb), 'available');
});

test('resources: lists tagged resources with the page states and the tag value as the group', async () => {
  const listed = await resources.list();
  const find = (type, id) => listed.find((resource) => resource.type === type && resource.id === id);
  assert.deepEqual(find('ec2', taggedInstance), {
    type: 'ec2', id: taggedInstance, name: `tagged-${run}`, state: 'running', group: 'demo',
  });
  assert.deepEqual(find('rds', taggedDb), {
    type: 'rds', id: taggedDb, name: taggedDb, state: 'running', group: 'demo',
  });
  assert.equal(find('ec2', untaggedInstance), undefined);
  assert.equal(find('rds', untaggedDb), undefined);
});

test('resources: refuses to stop an untagged instance or database', async () => {
  await assert.rejects(resources.stop('ec2', untaggedInstance), NotFoundError);
  await assert.rejects(resources.stop('rds', untaggedDb), NotFoundError);
  assert.equal(await rdsState(untaggedDb), 'available');
});

test('SSM: the parameter loader returns a decrypted SecureString', async () => {
  const name = `/power-switch-test/${run}/aud`;
  await ssmClient.send(new PutParameterCommand({ Name: name, Value: 'aud-123', Type: 'SecureString' }));
  assert.equal(await createParameterLoader(ssmClient)(name), 'aud-123');
});
