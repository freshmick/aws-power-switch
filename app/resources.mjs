// Lists, starts and stops the EC2 and RDS instances tagged with the power-switch tag. Every
// start/stop re-checks the tag before acting (defence in depth; IAM enforces the same condition).
//
// The ec2 and rds adapters are injected (see ec2.mjs and rds.mjs), each with:
//   listInstances() -> Promise<[{ id, name, state, tags, stoppedAt? }]>
//   start(id), stop(id) -> Promise<void>

export const RDS_AUTO_START_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// AWS states mapped to the four the page shows; anything else is passed through unchanged.
const STATES = {
  ec2: { pending: 'starting', running: 'running', stopping: 'stopping', 'shutting-down': 'stopping', stopped: 'stopped' },
  rds: { starting: 'starting', available: 'running', stopping: 'stopping', stopped: 'stopped' },
};

export class NotFoundError extends Error {}

export function createResources({ ec2, rds, tagKey }) {
  const adapters = { ec2, rds };

  async function listType(type) {
    const instances = await adapters[type].listInstances();
    return instances.filter((instance) => tagKey in instance.tags).map((instance) => toResource(type, instance));
  }

  async function list() {
    const [ec2Resources, rdsResources] = await Promise.all([listType('ec2'), listType('rds')]);
    return [...rdsResources, ...ec2Resources];
  }

  async function change(type, id, action) {
    if (!adapters[type]) throw new NotFoundError(`unknown type ${type}`);
    const tagged = await listType(type);
    if (!tagged.some((resource) => resource.id === id)) {
      throw new NotFoundError(`${type} ${id} is not tagged ${tagKey}`);
    }
    await adapters[type][action](id);
  }

  return {
    list,
    start: (type, id) => change(type, id, 'start'),
    stop: (type, id) => change(type, id, 'stop'),
  };
}

function toResource(type, { id, name, state, stoppedAt }) {
  const resource = { type, id, name: name || id, state: STATES[type][state] ?? state };
  if (type === 'rds' && resource.state === 'stopped') {
    resource.autoStartAt = stoppedAt ? new Date(stoppedAt.getTime() + RDS_AUTO_START_DAYS * DAY_MS).toISOString() : null;
  }
  return resource;
}
