// Verifies the Cloudflare Access token (Cf-Access-Jwt-Assertion) on every request, so the raw
// Function URL is useless without going through Access:
// RS256 against https://<team>/cdn-cgi/access/certs, checks aud, iss, exp and requires
// exp, iss, sub and email.
import { createPublicKey, verify } from 'node:crypto';

const REQUIRED_CLAIMS = ['exp', 'iss', 'sub', 'email'];
// The Function URL is public, so junk tokens with random kids must not each trigger a certs fetch.
const MIN_REFETCH_MS = 60_000;

export class AccessDeniedError extends Error {}

// fetchKeys(certsUrl) -> Promise<JWK[]>; now() -> epoch milliseconds. Both injected for tests.
export function createAccessVerifier({ teamDomain, aud, fetchKeys = fetchAccessKeys, now = Date.now }) {
  const issuer = `https://${teamDomain}`;
  const keyCache = createKeyCache(`${issuer}/cdn-cgi/access/certs`, fetchKeys, now);

  return async function verifyAccessToken(token) {
    if (!token) throw new AccessDeniedError('missing token');
    const { header, claims, signedPart, signature } = decode(token);
    if (header.alg !== 'RS256') throw new AccessDeniedError('unexpected alg');
    const key = await keyCache.get(header.kid);
    if (!verify('RSA-SHA256', Buffer.from(signedPart), key, signature)) {
      throw new AccessDeniedError('bad signature');
    }
    checkClaims(claims, { issuer, aud, nowSeconds: now() / 1000 });
    return claims;
  };
}

export async function fetchAccessKeys(certsUrl) {
  const response = await fetch(certsUrl);
  if (!response.ok) throw new Error(`Fetching Access certs failed: ${response.status}`);
  const { keys } = await response.json();
  return keys;
}

// Keys are cached by kid; an unknown kid triggers a refetch (Cloudflare rotates keys), at most once
// per MIN_REFETCH_MS. Between refetches an unknown kid is rejected without a fetch. The attempt
// time is recorded before fetching, so failed or concurrent fetches are throttled too.
function createKeyCache(certsUrl, fetchKeys, now) {
  let keys = new Map();
  let lastFetchMs = -Infinity;
  return {
    async get(kid) {
      if (!keys.has(kid) && now() - lastFetchMs >= MIN_REFETCH_MS) {
        lastFetchMs = now();
        const jwks = await fetchKeys(certsUrl);
        keys = new Map(jwks.map((jwk) => [jwk.kid, createPublicKey({ key: jwk, format: 'jwk' })]));
      }
      const key = keys.get(kid);
      if (!key) throw new AccessDeniedError('unknown signing key');
      return key;
    },
  };
}

function decode(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AccessDeniedError('malformed token');
  try {
    return {
      header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
      claims: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
      signedPart: `${parts[0]}.${parts[1]}`,
      signature: Buffer.from(parts[2], 'base64url'),
    };
  } catch {
    throw new AccessDeniedError('malformed token');
  }
}

function checkClaims(claims, { issuer, aud, nowSeconds }) {
  for (const name of REQUIRED_CLAIMS) {
    if (claims[name] === undefined) throw new AccessDeniedError(`missing claim ${name}`);
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(aud)) throw new AccessDeniedError('wrong aud');
  if (claims.iss !== issuer) throw new AccessDeniedError('wrong iss');
  if (claims.exp <= nowSeconds) throw new AccessDeniedError('expired');
  if (claims.nbf !== undefined && claims.nbf > nowSeconds) throw new AccessDeniedError('not yet valid');
}
