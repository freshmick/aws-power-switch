# The Cloudflare side of the CDK standalone example. Apply it after `cdk deploy` in the folder
# above: the edge module reads the Function URL from the SSM parameter the stack wrote.

# --- Access team domain: looked up from the account, written where the Lambda reads it ------------------

data "cloudflare_zero_trust_organization" "this" {
  account_id = var.account_id
}

# auth_domain is the bare host, e.g. example.cloudflareaccess.com, which is what the Lambda expects.
resource "aws_ssm_parameter" "access_team_domain" {
  name  = var.access_team_domain_parameter
  type  = "String"
  value = data.cloudflare_zero_trust_organization.this.auth_domain
}

# --- Who may sign in --------------------------------------------------------------------------------------

resource "cloudflare_zero_trust_access_policy" "allowed_emails" {
  account_id = var.account_id
  name       = "${var.name_prefix} power switch users"
  decision   = "allow"
  include    = [for email in var.allowed_emails : { email = { email = email } }]
}

# --- Worker and Access application ------------------------------------------------------------------------

module "power_switch_edge" {
  source = "../../../modules/cloudflare-edge"

  account_id             = var.account_id
  name_prefix            = var.name_prefix
  zone_name              = var.zone_name
  power_hostname         = var.power_hostname
  function_url_parameter = var.function_url_parameter
  access_aud_parameter   = var.access_aud_parameter
  allowed_idps           = var.identity_provider_ids
  policy_ids             = [cloudflare_zero_trust_access_policy.allowed_emails.id]
}
