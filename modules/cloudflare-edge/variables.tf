variable "account_id" {
  description = "Cloudflare account ID that owns the Worker and the Access application."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for the Worker script and Access application names, e.g. example. Unique per Cloudflare account."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*$", var.name_prefix))
    error_message = "name_prefix must be lowercase letters, digits and hyphens, starting with a letter or digit."
  }
}

variable "zone_name" {
  description = "Cloudflare zone the power hostname belongs to, e.g. example.com."
  type        = string
}

variable "power_hostname" {
  description = "Hostname of the power switch page, e.g. power.example.com. The module puts a Worker and an Access application on it."
  type        = string

  validation {
    condition     = length(var.power_hostname) > 0
    error_message = "power_hostname must not be empty."
  }
}

variable "function_url_parameter" {
  description = "Name of the SSM parameter holding the Lambda's Function URL, e.g. /example/power/function_url."
  type        = string
}

variable "allowed_idps" {
  description = "IDs of existing Access identity providers to sign in with. The Access application allows exactly these."
  type        = list(string)

  validation {
    condition     = length(var.allowed_idps) > 0
    error_message = "allowed_idps must name at least one identity provider; an empty list would allow every provider in the account."
  }
}

variable "policy_ids" {
  description = "IDs of existing reusable Access policies deciding who may sign in, in precedence order. The module creates no policy of its own."
  type        = list(string)

  validation {
    condition     = length(var.policy_ids) > 0
    error_message = "policy_ids must name at least one Access policy."
  }
}

variable "access_aud_parameter" {
  description = "Name of the SSM parameter to write the Access application's audience to, e.g. /example/power/access_aud."
  type        = string
}
