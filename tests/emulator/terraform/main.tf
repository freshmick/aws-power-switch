# Smoke test: applies the lambda module against a local AWS Emulator
# (https://github.com/aws/aws-emulator). It proves the module's resources create and that a second
# plan is clean. It does not prove the function runs or that the IAM policy holds: the emulator
# does not run the app's Node code or evaluate IAM tag conditions the way AWS does.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "emulator_endpoint" {
  description = "The local AWS Emulator's endpoint."
  type        = string
  default     = "https://127.0.0.1:9297"

  validation {
    condition     = startswith(var.emulator_endpoint, "https://127.0.0.1:")
    error_message = "This root only applies to an AWS Emulator on 127.0.0.1, never to real AWS."
  }
}

# Every service the module calls is pinned to the emulator here, so this root cannot reach real
# AWS even when AWS_ENDPOINT_URL is unset.
provider "aws" {
  region = "us-east-1"

  endpoints {
    iam    = var.emulator_endpoint
    lambda = var.emulator_endpoint
    logs   = var.emulator_endpoint
    ssm    = var.emulator_endpoint
    sts    = var.emulator_endpoint
  }
}

resource "aws_ssm_parameter" "access_team_domain" {
  name  = "/power-switch-test/access/team-domain"
  type  = "String"
  value = "example.cloudflareaccess.com"
}

resource "aws_ssm_parameter" "access_aud" {
  name  = "/power-switch-test/access/aud"
  type  = "SecureString"
  value = "not-a-real-aud"
}

module "power_switch" {
  source = "../../../modules/lambda"

  name_prefix                  = "emulator"
  power_hostname               = "power.example.com"
  access_team_domain_parameter = aws_ssm_parameter.access_team_domain.name
  access_aud_parameter         = aws_ssm_parameter.access_aud.name
  function_url_parameter       = "/power-switch-test/function-url"
}

output "function_name" {
  value = module.power_switch.function_name
}
