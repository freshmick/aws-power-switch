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

// The local server's data: groups `demo` (a stopped node, a running database) and `docs` (a stopped
// node and a stopped database), one resource with an empty group, and one untagged.
export function groupedEc2() {
  return createFakeAdapter([
    { id: 'i-0demo', name: 'demo-node', state: 'stopped', tags: { 'power-switch': 'demo' } },
    { id: 'i-0docs', name: 'docs-node', state: 'stopped', tags: { 'power-switch': 'docs' } },
    { id: 'i-0node', name: 'example-node', state: 'running', tags: { 'power-switch': '' } },
    { id: 'i-0other', name: 'untagged', state: 'running', tags: {} },
  ]);
}

export function groupedRds() {
  return createFakeAdapter([
    { id: 'example-db', state: 'available', tags: { 'power-switch': 'demo' } },
    { id: 'docs-db', state: 'stopped', stoppedAt: new Date(), tags: { 'power-switch': 'docs' } },
  ], { runningState: 'available' });
}

// Wraps an adapter so start and stop of instance `failId` reject, to try a failed action locally.
export function failingOn(adapter, failId) {
  const fail = (action, id) => {
    if (id === failId) throw new Error(`injected ${action} failure for ${id}`);
  };
  return {
    ...adapter,
    async start(id) { fail('start', id); return adapter.start(id); },
    async stop(id) { fail('stop', id); return adapter.stop(id); },
  };
}
