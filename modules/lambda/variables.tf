variable "name_prefix" {
  description = "Prefix for resource names; the function, role and log group are named <name_prefix>-power-switch. E.g. example."
  type        = string

  validation {
    condition     = length(var.name_prefix) > 0
    error_message = "name_prefix must not be empty."
  }
}

variable "power_hostname" {
  description = "Hostname of the power switch page, e.g. power.example.com; POSTs from any other origin are refused."
  type        = string

  validation {
    condition     = length(var.power_hostname) > 0
    error_message = "power_hostname must not be empty (the hostname the page is served on, e.g. power.example.com)."
  }
}

variable "tag_key" {
  description = "Only EC2 and RDS instances carrying this tag key are listed and can be started or stopped."
  type        = string
  default     = "power-switch"
}

variable "access_team_domain_parameter" {
  description = "Name of the SSM parameter holding the Cloudflare Access team domain, e.g. /example/access_team_domain. The function only reads it."
  type        = string
}

variable "access_aud_parameter" {
  description = "Name of the SSM parameter holding the Access application's audience (AUD) tag, e.g. /example/power/access_aud. The function only reads it."
  type        = string
}

variable "function_url_parameter" {
  description = "Name of the SSM parameter this module creates with the Function URL, e.g. /example/power/function_url."
  type        = string
}

variable "reserved_concurrency" {
  description = "Maximum concurrent invocations; the Function URL is public, so this caps what a flood can use of the account's pool. null reserves no concurrency."
  type        = number
  default     = 2
  nullable    = true
}

variable "log_retention_days" {
  description = "How long the function's logs are kept, in days."
  type        = number
  default     = 14
}
