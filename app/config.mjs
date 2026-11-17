// Reads the switch's configuration. Plain values come from the environment; the Access team
// domain and the power host's Access AUD live in Parameter Store (written by whatever
// provisions Access), so only their parameter names are in the environment. Reading the AUD at
// runtime avoids a dependency loop between the Lambda and the Access application. POWER_HOSTNAME is the
// page's hostname; POSTs from any other origin are refused.

export const DEFAULT_TAG_KEY = 'power-switch';

// loadParameter(name) -> Promise<string>; injected so tests need no AWS.
export async function loadConfig(env, loadParameter) {
  const teamDomainParameter = required(env, 'ACCESS_TEAM_DOMAIN_PARAMETER');
  const audParameter = required(env, 'ACCESS_AUD_PARAMETER');
  const powerHostname = required(env, 'POWER_HOSTNAME');
  const [teamDomain, accessAud] = await Promise.all([
    loadParameter(teamDomainParameter),
    loadParameter(audParameter),
  ]);
  return {
    tagKey: env.TAG_KEY || DEFAULT_TAG_KEY,
    teamDomain: requiredValue(teamDomainParameter, teamDomain),
    accessAud: requiredValue(audParameter, accessAud),
    allowedOrigin: `https://${powerHostname}`,
  };
}

function required(env, name) {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function requiredValue(parameterName, value) {
  if (!value) throw new Error(`Parameter ${parameterName} is empty`);
  return value;
}
