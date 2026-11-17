// Forwards every request on the power hostname to the power switch's Function URL.
// Cloudflare Access sits in front of this hostname and adds Cf-Access-Jwt-Assertion, which the
// Lambda verifies itself. Method, path, query, headers and body are kept; the Host follows the URL.

// The upstream URL: the Function URL with the incoming path and query. Only pathname and search
// are copied, so a path like `//evil.com/x` can't change the host the Access token goes to.
export function upstreamUrl(requestUrl, functionUrl) {
  const incoming = new URL(requestUrl);
  const base = new URL(functionUrl);
  const target = new URL(base);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  if (target.origin !== base.origin) {
    throw new Error(`upstream origin ${target.origin} is not the Function URL origin`);
  }
  return target;
}

export default {
  async fetch(request, env) {
    const target = upstreamUrl(request.url, env.FUNCTION_URL);
    return fetch(new Request(target, request));
  },
};
