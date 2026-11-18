// Shared helpers for the tests that run against a local AWS Emulator (https://github.com/aws/aws-emulator).

// These tests create and stop instances, so they must never reach real AWS. The AWS SDK calls
// real AWS when AWS_ENDPOINT_URL is unset; this refuses anything but a loopback endpoint.
export function requireEmulator(env = process.env) {
  const endpoint = env.AWS_ENDPOINT_URL ?? '';
  if (!endpoint.startsWith('https://127.0.0.1:')) {
    throw new Error(`AWS_ENDPOINT_URL must point at a local AWS Emulator (https://127.0.0.1:<port>), got "${endpoint}"`);
  }
}

// Polls read() once a second until it returns `wanted`. The emulator changes state in about a second.
export async function waitFor(read, wanted, seconds = 60) {
  let last;
  for (let attempt = 0; attempt < seconds; attempt++) {
    last = await read();
    if (last === wanted) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`still "${last}" after ${seconds}s, wanted "${wanted}"`);
}
