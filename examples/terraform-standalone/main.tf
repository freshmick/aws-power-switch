# The whole power switch as its own stack in one root: the Lambda (modules/lambda) and the Cloudflare
# Worker and Access application in front of it (modules/cloudflare-edge). The edge gets the Function
# URL straight from the lambda module, so a single `terraform apply` creates everything.

locals {
  # The three SSM parameters the pieces talk through, named after the prefix.
  parameter_prefix             = "/${var.name_prefix}/power-switch"
  access_team_domain_parameter = "${local.parameter_prefix}/access_team_domain"
  access_aud_parameter         = "${local.parameter_prefix}/access_aud"
  function_url_parameter       = "${local.parameter_prefix}/function_url"
}

# --- Access team domain: looked up from the Cloudflare account, written where the Lambda reads it --------

data "cloudflare_zero_trust_organization" "this" {
  account_id = var.account_id
}

# auth_domain is <team>.cloudflareaccess.com without https://, the form the Lambda expects.
resource "aws_ssm_parameter" "access_team_domain" {
  name  = local.access_team_domain_parameter
  type  = "String"
  value = data.cloudflare_zero_trust_organization.this.auth_domain
}

# --- Who may sign in: a reusable Access policy allowing exactly allowed_emails --------------------------

resource "cloudflare_zero_trust_access_policy" "allowed_emails" {
  account_id = var.account_id
  name       = "${var.name_prefix} power switch users"
  decision   = "allow"
  include    = [for email in var.allowed_emails : { email = { email = email } }]
}

# --- AWS side -------------------------------------------------------------------------------------------

module "power_switch" {
  source = "../../modules/lambda"

  name_prefix                  = var.name_prefix
  power_hostname               = var.power_hostname
  access_team_domain_parameter = local.access_team_domain_parameter
  access_aud_parameter         = local.access_aud_parameter
  function_url_parameter       = local.function_url_parameter
}

# --- Cloudflare side ------------------------------------------------------------------------------------

module "power_switch_edge" {
  source = "../../modules/cloudflare-edge"

  account_id           = var.account_id
  name_prefix          = var.name_prefix
  zone_name            = var.zone_name
  power_hostname       = var.power_hostname
  function_url         = module.power_switch.function_url
  access_aud_parameter = local.access_aud_parameter
  allowed_idps         = var.identity_provider_ids
  policy_ids           = [cloudflare_zero_trust_access_policy.allowed_emails.id]
}
