// Runs the handler locally against in-memory fakes, with no AWS and no Access check:
//   node dev/serve.mjs   then open http://localhost:8787 (PORT overrides the port)
// It listens on 127.0.0.1 only, since nothing checks who calls it; POWER_SWITCH_DEV_HOST overrides that.
// Local development only; the Lambda package should leave out dev/ and tests/.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHandler } from '../handler.mjs';
import { createResources } from '../resources.mjs';
import { DEFAULT_TAG_KEY } from '../config.mjs';
import { sampleEc2, sampleRds } from './fakes.mjs';

const port = Number(process.env.PORT) || 8787;
const host = process.env.POWER_SWITCH_DEV_HOST || '127.0.0.1';

const handle = createHandler({
  verifyAccessToken: async () => ({ email: 'local@example.com' }),
  resources: createResources({ ec2: sampleEc2(), rds: sampleRds(), tagKey: DEFAULT_TAG_KEY }),
  page: readFileSync(new URL('../page.html', import.meta.url), 'utf8'),
  allowedOrigin: `http://localhost:${port}`,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const response = await handle({ rawPath: url.pathname, requestContext: { http: { method: req.method } }, headers: req.headers });
  res.writeHead(response.statusCode, response.headers).end(response.body);
});
server.listen(port, host, () => {
  console.log(`Power switch (fakes) on http://localhost:${port} (listening on ${server.address().address})`);
});
