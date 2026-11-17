// Thin RDS adapter over AWS SDK v3 (shipped with the Lambda runtime). DescribeDBInstances has no
// tag filter, so it returns every instance with its tags; resources.mjs keeps the tagged ones.
// The tag key is only used here to skip the stop-time lookup for instances the switch won't show.
import {
  DescribeDBInstancesCommand,
  DescribeEventsCommand,
  StartDBInstanceCommand,
  StopDBInstanceCommand,
} from '@aws-sdk/client-rds';

// RDS keeps no "stopped at" field; the stop event (RDS-EVENT-0087) carries it. Its wording is
// "DB instance stopped" or "The DB instance has been stopped.", unlike RDS-EVENT-0154
// ("...exceeding the maximum allowed time being stopped.").
const STOPPED_EVENT = /^(the )?db instance (has been )?stopped\.?$/i;
const EVENT_LOOKBACK_MINUTES = 8 * 24 * 60;

export function createRdsAdapter(client, tagKey) {
  async function stoppedAt(id) {
    const { Events = [] } = await client.send(new DescribeEventsCommand({
      SourceType: 'db-instance',
      SourceIdentifier: id,
      Duration: EVENT_LOOKBACK_MINUTES,
    }));
    const stopTimes = Events
      .filter((event) => STOPPED_EVENT.test(event.Message ?? ''))
      .map((event) => new Date(event.Date).getTime());
    return stopTimes.length ? new Date(Math.max(...stopTimes)) : undefined;
  }

  return {
    async listInstances() {
      const instances = [];
      let Marker;
      do {
        const page = await client.send(new DescribeDBInstancesCommand({ Marker }));
        instances.push(...(page.DBInstances ?? []).filter(isStandalone).map(toInstance));
        Marker = page.Marker;
      } while (Marker);
      const stopped = instances.filter((instance) => instance.state === 'stopped' && tagKey in instance.tags);
      await Promise.all(stopped.map(async (instance) => {
        instance.stoppedAt = await stoppedAt(instance.id);
      }));
      return instances;
    },
    async start(id) {
      await client.send(new StartDBInstanceCommand({ DBInstanceIdentifier: id }));
    },
    async stop(id) {
      await client.send(new StopDBInstanceCommand({ DBInstanceIdentifier: id }));
    },
  };
}

// A cluster member (Aurora, Multi-AZ cluster) can't be started or stopped on its own: the instance
// calls fail, only the cluster calls work. So it is left out of the listing.
function isStandalone(db) {
  return !db.DBClusterIdentifier;
}

function toInstance(db) {
  const tags = Object.fromEntries((db.TagList ?? []).map(({ Key, Value }) => [Key, Value]));
  return { id: db.DBInstanceIdentifier, name: tags.Name, state: db.DBInstanceStatus, tags };
}
