# Plan-only, with mock providers: needs no AWS or Cloudflare credentials.

mock_provider "aws" {
  # The lambda module's IAM role needs a policy document that parses as JSON.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

mock_provider "cloudflare" {}

variables {
  region                = "us-east-1"
  account_id            = "0123456789abcdef0123456789abcdef"
  zone_name             = "example.com"
  power_hostname        = "power.example.com"
  name_prefix           = "example"
  identity_provider_ids = ["00000000-0000-0000-0000-000000000000"]
}

run "empty_allowed_emails_is_rejected" {
  command = plan

  variables {
    allowed_emails = []
  }

  expect_failures = [var.allowed_emails]
}

run "each_allowed_email_is_included_in_the_policy" {
  command = plan

  variables {
    allowed_emails = ["someone@example.com", "someone.else@example.com"]
  }

  assert {
    # include is a set, so compare without order.
    condition = toset([for rule in cloudflare_zero_trust_access_policy.allowed_emails.include : rule.email.email]) == toset([
      "someone@example.com",
      "someone.else@example.com",
    ])
    error_message = "The Access policy must include exactly the allowed emails."
  }
}
