# 1. Package design

## Status

Accepted, 2026-11-16

## Context

A power switch is a small web page, behind Cloudflare Access, that starts and
stops AWS resources carrying a tag, so that compute only runs while someone is
working. One already works, but it lives inside the infrastructure of the
project it was extracted from: its names, SSM paths and Access setup are
specific to that project, and it is packaged only as Terraform. Every other
project would have to copy it, and the copies, including their security
checks, would drift apart.

`aws-power-switch` turns it into a standalone, versioned package that any
project installs into its own AWS account. This ADR records why the package
is shaped the way it is.

## Decision

### One install per AWS account and region

Each install runs one Lambda in one AWS account and one region, and controls
only the resources in that account and region. There are no cross-account
roles. To cover another region, install again there with a different
`name_prefix` and hostname. Several regions per install is left for later.

Alternatives considered:

- **A central switch with cross-account roles.** One page for every account
  would be convenient, but a compromise of that switch would reach every
  project's account. Per-account installs keep each blast radius to one
  account.

### Terraform and plain-Python CDK wrappers around one app bundle

The app (a dependency-free Node Lambda) is the single source of truth. A
Terraform `lambda` module and a Python CDK construct, `PowerSwitch`, each
deploy that identical app code and create the same AWS resources. The CDK
construct is plain Python, not jsii, and ships the app as package data.

Alternatives considered:

- **Terraform only.** Projects whose infrastructure is Python CDK would have
  to adopt Terraform for AWS just for the switch.
- **A copy of the app per wrapper.** The copies would drift, and behaviour and
  security checks would depend on which IaC tool installed it.
- **A TypeScript/jsii construct.** It would add a build toolchain and a
  multi-language release for no current user; plain Python covers the CDK
  users we have.
- **An installer that needs no IaC (a CloudFormation template or a CLI).**
  Every intended user already manages their account with Terraform or CDK, so
  it would be a third wrapper to keep in sync.

### Tag key for authorisation, tag value for grouping

A fixed tag key per install (chosen by the installer, default `power-switch`)
marks a resource as switchable. IAM and the per-action re-check are
conditioned on the key only. The tag's value names the resource's group on
the page; an empty value is listed as "ungrouped". Group actions are a
client-side loop over the per-resource endpoints; no group route is added.

Alternatives considered:

- **An allowed-values filter on the tag value.** It would add a second
  authorisation rule to keep in sync between IAM and the app, with no current
  need; values stay for display only.
- **Per-group permissions.** Anyone who passes an install's Access policy can
  switch every tagged resource in that account and region. Finer rules would
  need a permission model the package does not have, and the account boundary
  already separates projects.
- **A server-side group route.** It would grow the server's attack surface;
  looping over the existing per-resource POSTs reuses checks that already
  exist.

### Cloudflare Access as the only auth in v1, configured per install

Every route, the page included, requires a valid Cloudflare Access JWT. Each
install reads its Access team domain and audience from SSM parameters whose
names are inputs, so the AWS and Cloudflare sides can be applied in either
order. The verifier stays behind an injected interface.

Alternatives considered:

- **Supporting other auth providers in v1.** No current user needs one, and
  each provider is more security-critical code to test. The injected
  interface leaves room to add one later.
- **Shared or hard-coded Access settings.** They would tie the package to one
  Cloudflare account and team; per-install SSM parameters let any project
  bring its own.

### Edge as Terraform only, taking existing IdPs and policies

A Terraform `cloudflare-edge` module creates a Worker on the install's
hostname, forwarding to the Lambda's Function URL, and an Access app in front
of it. It takes the project's existing identity providers (`allowed_idps`) and
Access policies (`policy_ids`) as inputs and never creates its own policy. CDK
users use this module for the Cloudflare side too.

Alternatives considered:

- **A Cloudflare CDK integration.** It would duplicate the edge in a second
  tool for little gain; CDK users can apply the Terraform edge module next to
  their stack.
- **The module creating its own Access policy.** The project would maintain a
  second allow-list; reusing its existing policies keeps one source of truth
  for who may log in.
- **Routing through the project's existing tunnels.** The switch must keep
  working while the nodes behind those tunnels are off, so the Worker talks
  to the Function URL directly.

### Semver git tags; registries deferred until public

One semver git tag covers the app and both wrappers. Terraform consumers use a
`git::` source with `?ref=`; CDK consumers `pip install` from git with a
subdirectory.

Alternatives considered:

- **Publishing to npm, PyPI or the Terraform registry.** Git tags work for
  both tools today; registries can follow later.
- **Separate versions per wrapper.** The wrappers must deploy the same app, so
  one tag for everything keeps them from drifting apart.

### v1 limited to EC2 and RDS

Only EC2 instances and RDS DB instances are ever listed or actionable. The
adapter shape (`listInstances`, `start`, `stop`) is kept as is.

Alternatives considered:

- **ECS services, Auto Scaling groups and Aurora clusters.** They would need
  the hard-wired `ec2|rds` routing, labels and IAM refactored into one adapter
  list first. That is real work with no current need, and it would break
  behaviour parity with the switch this package was extracted from.

## Consequences

- A compromise of one install stays inside its AWS account; the cost is one
  page per account and region rather than one page for everything.
- Behaviour and security checks are the same whichever wrapper installs the
  switch. Both wrappers must be kept in step, so CI runs the app tests,
  `terraform validate` on both modules and a CDK synth test on every PR.
- Untagging a resource takes it out of the switch's reach immediately. Anyone
  allowed in by an install's Access policy can switch every tagged EC2 and RDS
  instance in that account and region.
- Installs depend on Cloudflare. A project without Cloudflare Access cannot
  use v1.
- CDK users need Terraform for the Cloudflare side.
- Consumers pin a git tag and upgrade deliberately. Nothing is published to
  registries yet.
- Adding a resource type or an auth provider is a later, deliberate change,
  not a configuration option.
