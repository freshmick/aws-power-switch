// Lambda entry point (handler: index.handler). Wires the real AWS clients into the app once per
// cold start; everything else is built from injected dependencies in the other modules.
import { EC2Client } from '@aws-sdk/client-ec2';
import { RDSClient } from '@aws-sdk/client-rds';
import { SSMClient } from '@aws-sdk/client-ssm';
import { loadConfig } from './config.mjs';
import { createAccessVerifier } from './access.mjs';
import { createResources } from './resources.mjs';
import { createHandler } from './handler.mjs';
import { createEc2Adapter } from './ec2.mjs';
import { createRdsAdapter } from './rds.mjs';
import { createParameterLoader } from './ssm.mjs';
import { loadPage } from './page.mjs';

const page = loadPage();

async function buildApp() {
  const config = await loadConfig(process.env, createParameterLoader(new SSMClient()));
  return createHandler({
    verifyAccessToken: createAccessVerifier({ teamDomain: config.teamDomain, aud: config.accessAud }),
    resources: createResources({
      ec2: createEc2Adapter(new EC2Client(), config.tagKey),
      rds: createRdsAdapter(new RDSClient(), config.tagKey),
      tagKey: config.tagKey,
    }),
    page,
    allowedOrigin: config.allowedOrigin,
  });
}

let app;

export async function handler(event) {
  app ??= buildApp().catch((error) => {
    app = undefined; // retry on the next invocation instead of caching the failure
    throw error;
  });
  return (await app)(event);
}
