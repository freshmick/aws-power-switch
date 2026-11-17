import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccessVerifier, AccessDeniedError } from '../access.mjs';
import { createSigner, TEAM_DOMAIN, AUD, NOW_MS } from './tokens.mjs';

const signer = createSigner();

function verifier(keys = [signer.jwk]) {
  const fetched = [];
  const verify = createAccessVerifier({
    teamDomain: TEAM_DOMAIN,
    aud: AUD,
    now: () => NOW_MS,
    fetchKeys: async (url) => {
      fetched.push(url);
      return keys;
    },
  });
  return { verify, fetched };
}

test('accepts a valid token and fetches keys from the team certs URL', async () => {
  const { verify, fetched } = verifier();
  const claims = await verify(signer.token());
  assert.equal(claims.email, 'admin@example.com');
  assert.deepEqual(fetched, [`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`]);
});

test('caches keys between verifications', async () => {
  const { verify, fetched } = verifier();
  await verify(signer.token());
  await verify(signer.token());
  assert.equal(fetched.length, 1);
});

test('accepts aud as a plain string', async () => {
  const { verify } = verifier();
  await verify(signer.token({ aud: AUD }));
});

const rejected = {
  'missing token': () => undefined,
  'malformed token': () => 'not-a-jwt',
  'wrong aud': () => signer.token({ aud: ['other-aud'] }),
  'wrong iss': () => signer.token({ iss: 'https://evil.example.com' }),
  expired: () => signer.token({ exp: NOW_MS / 1000 - 1 }),
  'not yet valid': () => signer.token({ nbf: NOW_MS / 1000 + 60 }),
  'missing email': () => signer.token({ email: undefined }),
  'bad signature': () => createSigner().token(),
  'tampered claims': () => {
    const [header, , signature] = signer.token().split('.');
    const claims = Buffer.from(JSON.stringify({ aud: [AUD], email: 'x' })).toString('base64url');
    return `${header}.${claims}.${signature}`;
  },
  'unknown kid': () => createSigner('other-kid').token(),
  'non-RS256 alg': () => signer.token({}, { alg: 'HS256' }),
};

for (const [name, makeToken] of Object.entries(rejected)) {
  test(`rejects ${name}`, async () => {
    const { verify } = verifier();
    await assert.rejects(verify(makeToken()), AccessDeniedError);
  });
}

test('refetches keys when it sees an unknown kid (key rotation)', async () => {
  const rotated = createSigner('rotated-kid');
  let keys = [signer.jwk];
  let nowMs = NOW_MS;
  const verify = createAccessVerifier({
    teamDomain: TEAM_DOMAIN, aud: AUD, now: () => nowMs, fetchKeys: async () => keys,
  });
  await verify(signer.token());
  keys = [signer.jwk, rotated.jwk];
  nowMs += 60_000;
  await verify(rotated.token({ exp: nowMs / 1000 + 300 }));
});

test('refetches at most once a minute for unknown kids', async () => {
  let nowMs = NOW_MS;
  let fetches = 0;
  const verify = createAccessVerifier({
    teamDomain: TEAM_DOMAIN,
    aud: AUD,
    now: () => nowMs,
    fetchKeys: async () => {
      fetches += 1;
      return [signer.jwk];
    },
  });
  await verify(signer.token());
  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(verify(createSigner(`junk-${i}`).token()), AccessDeniedError);
  }
  assert.equal(fetches, 1);

  nowMs += 60_000;
  await assert.rejects(verify(createSigner('junk-late').token()), AccessDeniedError);
  assert.equal(fetches, 2);
});

test('still accepts known kids while refetching is throttled', async () => {
  const { verify, fetched } = verifier();
  await verify(signer.token());
  await assert.rejects(verify(createSigner('junk').token()), AccessDeniedError);
  await verify(signer.token());
  assert.equal(fetched.length, 1);
});

test('throttles refetching after a failed fetch', async () => {
  let fetches = 0;
  const verify = createAccessVerifier({
    teamDomain: TEAM_DOMAIN,
    aud: AUD,
    now: () => NOW_MS,
    fetchKeys: async () => {
      fetches += 1;
      throw new Error('certs unavailable');
    },
  });
  await assert.rejects(verify(signer.token()), /certs unavailable/);
  await assert.rejects(verify(signer.token()), AccessDeniedError);
  assert.equal(fetches, 1);
});
