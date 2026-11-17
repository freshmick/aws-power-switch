# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it through GitHub's private vulnerability reporting: open the repo's **Security** tab and choose **Report a vulnerability**.

Say what you found, how to reproduce it, and which release you saw it in.

## In scope

- The app (`app/`): the Lambda that verifies the Access token and starts or stops resources.
- The Worker (`modules/cloudflare-edge/`).
- Both IAM policies: `modules/lambda/iam.tf` and `cdk/src/aws_power_switch_cdk/iam.py`.
- The Terraform modules (`modules/`).

The checks these are meant to enforce are listed in the README's [security model](README.md#security-model).

## Supported versions

Only the latest release is supported. Fixes ship as a new release; older tags are not patched.
