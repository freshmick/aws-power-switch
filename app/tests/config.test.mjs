import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.mjs';

const PARAMETERS = {
  '/example/edge/access_team_domain': 'team.cloudflareaccess.com',
  '/example/power/access_aud': 'power-aud',
};
const ENV = {
  ACCESS_TEAM_DOMAIN_PARAMETER: '/example/edge/access_team_domain',
  ACCESS_AUD_PARAMETER: '/example/power/access_aud',
  POWER_HOSTNAME: 'power.example.com',
};
const loadParameter = async (name) => PARAMETERS[name];

test('loads parameter values named in the environment, default tag key', async () => {
  assert.deepEqual(await loadConfig(ENV, loadParameter), {
    tagKey: 'power-switch',
    teamDomain: 'team.cloudflareaccess.com',
    accessAud: 'power-aud',
    allowedOrigin: 'https://power.example.com',
  });
});

test('TAG_KEY overrides the tag key', async () => {
  const config = await loadConfig({ ...ENV, TAG_KEY: 'switchable' }, loadParameter);
  assert.equal(config.tagKey, 'switchable');
});

test('fails when a parameter name is missing from the environment', async () => {
  await assert.rejects(loadConfig({ ACCESS_AUD_PARAMETER: 'x' }, loadParameter), /ACCESS_TEAM_DOMAIN_PARAMETER/);
});

test('fails when a parameter is empty', async () => {
  await assert.rejects(loadConfig(ENV, async () => ''), /is empty/);
});

test('fails when POWER_HOSTNAME is missing', async () => {
  const { POWER_HOSTNAME, ...env } = ENV;
  await assert.rejects(loadConfig(env, loadParameter), /POWER_HOSTNAME/);
});
