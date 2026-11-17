// Test helper: a local RSA key pair standing in for Cloudflare Access's signing key.
import { generateKeyPairSync, sign } from 'node:crypto';

export const TEAM_DOMAIN = 'team.cloudflareaccess.com';
export const AUD = 'power-aud';
export const KID = 'test-kid';
export const NOW_MS = Date.UTC(2026, 9, 28, 12, 0, 0);

export function createSigner(kid = KID) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256' };
  return {
    jwk,
    token(claimOverrides = {}, headerOverrides = {}) {
      const header = { alg: 'RS256', kid, typ: 'JWT', ...headerOverrides };
      const claims = {
        aud: [AUD],
        iss: `https://${TEAM_DOMAIN}`,
        sub: 'user-1',
        email: 'admin@example.com',
        exp: NOW_MS / 1000 + 300,
        ...claimOverrides,
      };
      const signedPart = `${encode(header)}.${encode(claims)}`;
      const signature = sign('RSA-SHA256', Buffer.from(signedPart), privateKey).toString('base64url');
      return `${signedPart}.${signature}`;
    },
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
