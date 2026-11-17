# The power switch on its own hostname. A Worker forwards the hostname to the Lambda's Function URL,
# so the switch keeps working while the nodes behind any tunnel are off, and an Access application
# in front of it signs people in with the identity providers and policies the caller passes in.

data "cloudflare_zone" "this" {
  filter = { name = var.zone_name }
}

data "aws_ssm_parameter" "function_url" {
  name = var.function_url_parameter
}

# --- Worker ---------------------------------------------------------------------------------------------

resource "cloudflare_workers_script" "power" {
  account_id         = var.account_id
  script_name        = "${var.name_prefix}-power-switch"
  content_file       = "${path.module}/worker.js"
  content_sha256     = filesha256("${path.module}/worker.js")
  main_module        = "worker.js"
  compatibility_date = "2026-10-01"

  bindings = [{
    type = "plain_text"
    name = "FUNCTION_URL"
    text = data.aws_ssm_parameter.function_url.value
  }]
}

# Also creates the proxied DNS record for the hostname.
resource "cloudflare_workers_custom_domain" "power" {
  account_id = var.account_id
  zone_id    = data.cloudflare_zone.this.zone_id
  hostname   = var.power_hostname
  service    = cloudflare_workers_script.power.script_name
}

# --- Access: the caller's identity providers and policies, none of our own ------------------------------

resource "cloudflare_zero_trust_access_application" "power" {
  account_id   = var.account_id
  name         = "${var.name_prefix} power switch"
  type         = "self_hosted"
  domain       = var.power_hostname
  allowed_idps = var.allowed_idps

  # Skipping the provider picker only works with a single provider.
  auto_redirect_to_identity = length(var.allowed_idps) == 1

  # Lax, not strict: sign-in returns through the team domain, a cross-site redirect. The power
  # switch checks Origin itself for same-site subdomains.
  same_site_cookie_attribute = "lax"
  http_only_cookie_attribute = true

  policies = [for i, id in var.policy_ids : {
    id         = id
    precedence = i + 1
  }]
}

# --- Parameter Store: the Lambda reads the audience at cold start ---------------------------------------

resource "aws_ssm_parameter" "access_aud" {
  name  = var.access_aud_parameter
  type  = "String"
  value = cloudflare_zero_trust_access_application.power.aud
}
