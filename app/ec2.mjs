// Thin EC2 adapter over AWS SDK v3 (shipped with the Lambda runtime). No logic here beyond
// mapping responses; filtering and the tag check live in resources.mjs.
import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from '@aws-sdk/client-ec2';

export function createEc2Adapter(client, tagKey) {
  return {
    async listInstances() {
      const instances = [];
      let NextToken;
      do {
        const page = await client.send(new DescribeInstancesCommand({
          Filters: [{ Name: 'tag-key', Values: [tagKey] }],
          NextToken,
        }));
        for (const reservation of page.Reservations ?? []) {
          instances.push(...(reservation.Instances ?? []).map(toInstance));
        }
        NextToken = page.NextToken;
      } while (NextToken);
      return instances.filter((instance) => instance.state !== 'terminated');
    },
    async start(id) {
      await client.send(new StartInstancesCommand({ InstanceIds: [id] }));
    },
    async stop(id) {
      await client.send(new StopInstancesCommand({ InstanceIds: [id] }));
    },
  };
}

function toInstance(instance) {
  const tags = Object.fromEntries((instance.Tags ?? []).map(({ Key, Value }) => [Key, Value]));
  return { id: instance.InstanceId, name: tags.Name, state: instance.State?.Name, tags };
}
