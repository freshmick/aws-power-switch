// In-memory stand-ins for the EC2 and RDS adapters, used by the tests and the local server.
// Same interface as ec2.mjs / rds.mjs: listInstances(), start(id), stop(id).

export function createFakeAdapter(instances, { runningState = 'running' } = {}) {
  const calls = [];
  const find = (id) => instances.find((instance) => instance.id === id);
  return {
    calls,
    async listInstances() {
      return instances.map((instance) => ({ ...instance }));
    },
    async start(id) {
      calls.push(['start', id]);
      find(id).state = runningState;
    },
    async stop(id) {
      calls.push(['stop', id]);
      find(id).state = 'stopped';
      find(id).stoppedAt = new Date();
    },
  };
}

export function sampleEc2() {
  return createFakeAdapter([
    { id: 'i-0node', name: 'example-node', state: 'running', tags: { 'power-switch': 'true', Name: 'example-node' } },
    { id: 'i-0other', name: 'untagged', state: 'running', tags: { Name: 'untagged' } },
  ]);
}

export function sampleRds() {
  return createFakeAdapter([
    { id: 'example-db', state: 'available', tags: { 'power-switch': 'true' } },
    { id: 'other-db', state: 'available', tags: {} },
  ], { runningState: 'available' });
}
