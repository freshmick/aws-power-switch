# Risk paths (read by the pr-gate skill)

lane: mvp

Consumers pin a release tag, so a revert undoes any change here. A file matching a sensitive glob gets a second, security-minded reviewer; it does not by itself send the PR to the owner. Globs for files that don't exist yet are deliberate.

## sensitive
- `app/access.mjs` - the Cloudflare Access JWT verifier: junk-token guard, signing-key cache
- `app/handler.mjs` - the request handler: every route requires a valid Access JWT
- `app/origin.mjs` - the same-origin check on every POST
- `app/resources.mjs` - the per-action tag re-check and the EC2/RDS-only resource types
- `modules/lambda/iam.tf` - the Lambda's IAM policy in the Terraform lambda module: start/stop only on tagged resources
- `cdk/src/aws_power_switch_cdk/iam.py` - the Lambda's IAM policy in the CDK construct: start/stop only on tagged resources
- `.github/workflows/**` - CI, the checks themselves

## docs and tests
- `README.md`
- `docs/**`
- `app/tests/**`
- `cdk/tests/**`
- `modules/cloudflare-edge/worker.test.mjs`
