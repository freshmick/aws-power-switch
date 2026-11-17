// Routes Lambda Function URL requests (payload format 2.0). Every route, including the page,
// requires a valid Cloudflare Access token; otherwise 401. POSTs must also come from the page's
// own origin (origin.mjs); otherwise 403.
//
//   GET  /                                       the page
//   GET  /api/resources                          tagged EC2 and RDS instances with state
//   POST /api/resources/{type}/{id}/start|stop   start or stop one of them
import { NotFoundError } from './resources.mjs';
import { isSameOrigin } from './origin.mjs';

const ACTION_PATH = /^\/api\/resources\/(ec2|rds)\/([^/]+)\/(start|stop)$/;

// verifyAccessToken(token) -> Promise<claims>, throws when invalid.
// resources: { list(), start(type, id), stop(type, id) }. page: the HTML string.
// allowedOrigin: the power page's origin, e.g. 'https://power.example.com'.
// log: { info, warn, error }. Each start/stop request is logged to info as two JSON audit lines:
// "requested" before the action, so a timeout or crash still leaves a record of who asked, then
// its outcome: accepted, refused (not tagged) or failed (AWS error).
export function createHandler({ verifyAccessToken, resources, page, allowedOrigin, log = console }) {
  return async function handle(event) {
    const method = event.requestContext?.http?.method;
    const path = event.rawPath || '/';

    let claims;
    try {
      claims = await verifyAccessToken(event.headers?.['cf-access-jwt-assertion']);
    } catch (error) {
      log.warn(`Access token rejected: ${error.message}`);
      return json(401, { error: 'Unauthorized' });
    }

    if (method === 'POST' && !isSameOrigin(event.headers ?? {}, allowedOrigin)) {
      log.warn(`Cross-origin ${method} ${path} refused`);
      return json(403, { error: 'Forbidden' });
    }

    try {
      return await route(method, path, claims);
    } catch (error) {
      if (error instanceof NotFoundError) return json(404, { error: error.message });
      log.error(error); // AWS errors carry account IDs and ARNs: log them, don't return them
      return json(502, { error: 'Upstream error' });
    }
  };

  async function route(method, path, claims) {
    if (method === 'GET' && path === '/') return html(page);
    if (method === 'GET' && path === '/api/resources') return json(200, { resources: await resources.list() });
    const match = method === 'POST' && ACTION_PATH.exec(path);
    if (match) {
      const [, type, encodedId, action] = match;
      const id = safeDecode(encodedId);
      if (id === undefined) return json(400, { error: 'Bad request' });
      await audited(claims, action, type, id);
      return json(202, { ok: true });
    }
    return json(404, { error: 'Not found' });
  }

  // Logs who asked for what, runs start/stop, then logs how it ended. Errors are rethrown unchanged.
  async function audited(claims, action, type, id) {
    log.info(auditLine(claims, action, type, id, 'requested'));
    try {
      await resources[action](type, id);
    } catch (error) {
      log.info(auditLine(claims, action, type, id, error instanceof NotFoundError ? 'refused' : 'failed'));
      throw error;
    }
    log.info(auditLine(claims, action, type, id, 'accepted'));
  }
}

// From the verified Access claims; never the token, never error text.
function auditLine(claims, action, type, id, outcome) {
  return JSON.stringify({ audit: 'power-switch', email: claims?.email, sub: claims?.sub, action, type, id, outcome });
}

// undefined when the id has a malformed %-escape.
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

// No response may be framed (clickjacking). CSP frame-ancestors for current
// browsers, X-Frame-Options for old ones. Set on JSON too, so no route is left out.
const NO_FRAMING = { 'content-security-policy': "frame-ancestors 'none'", 'x-frame-options': 'DENY' };

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', ...NO_FRAMING }, body: JSON.stringify(body) };
}

function html(body) {
  return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...NO_FRAMING }, body };
}
