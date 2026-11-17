// Loads one Parameter Store value; the injected loader config.mjs uses in Lambda.
import { GetParameterCommand } from '@aws-sdk/client-ssm';

export function createParameterLoader(client) {
  return async function loadParameter(name) {
    const { Parameter } = await client.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return Parameter?.Value;
  };
}
