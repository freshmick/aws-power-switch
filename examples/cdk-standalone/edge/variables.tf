variable "account_id" {
  description = "Cloudflare account ID that owns the Worker, the Access application and the Access policy."
  type        = string
}

variable "zone_name" {
  description = "Cloudflare zone the power hostname belongs to, e.g. example.com."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for the Cloudflare resource names, e.g. example. Unique per Cloudflare account."
  type        = string
}

variable "power_hostname" {
  description = "Hostname of the power switch page; the same value as power_hostname in ../cdk.json."
  type        = string
}

variable "access_team_domain_parameter" {
  description = "Name of the SSM parameter to write the Access team domain to; the same name as in ../cdk.json."
  type        = string
}

variable "access_aud_parameter" {
  description = "Name of the SSM parameter to write the Access application's audience to; the same name as in ../cdk.json."
  type        = string
}

variable "function_url_parameter" {
  description = "Name of the SSM parameter the CDK stack wrote the Function URL to; the same name as in ../cdk.json."
  type        = string
}

variable "identity_provider_ids" {
  description = "IDs of existing Access identity providers to sign in with, e.g. your one-time PIN provider."
  type        = list(string)
}

variable "allowed_emails" {
  description = "Email addresses allowed to sign in to the power switch."
  type        = list(string)

  validation {
    condition     = length(var.allowed_emails) > 0
    error_message = "allowed_emails must list at least one email address; with none, nobody could sign in."
  }
}
