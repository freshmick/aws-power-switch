variable "region" {
  description = "AWS region for the Lambda and its SSM parameters, e.g. us-east-1."
  type        = string
}

variable "account_id" {
  description = "Cloudflare account ID that owns the Worker, the Access application and the Access policy."
  type        = string
}

variable "zone_name" {
  description = "Cloudflare zone the power hostname belongs to, e.g. example.com."
  type        = string
}

variable "power_hostname" {
  description = "Hostname of the power switch page, e.g. power.example.com."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource and SSM parameter names, e.g. example. Lowercase letters, digits and hyphens."
  type        = string
}

variable "identity_provider_ids" {
  description = "IDs of existing Cloudflare Access identity providers to sign in with."
  type        = list(string)
}

variable "allowed_emails" {
  description = "Email addresses allowed to sign in to the power switch."
  type        = list(string)

  validation {
    condition     = length(var.allowed_emails) > 0
    error_message = "allowed_emails must list at least one email address; an empty list would let nobody in."
  }
}
