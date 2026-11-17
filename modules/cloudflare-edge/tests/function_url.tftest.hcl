# Plan-only tests for how the edge module gets the Lambda's Function URL: passed in directly with
# function_url, or looked up from SSM with function_url_parameter. Exactly one must be set. Both
# providers are mocked, so no credentials are needed and nothing is read from AWS or Cloudflare.

mock_provider "aws" {
  mock_data "aws_ssm_parameter" {
    defaults = {
      value = "https://from-ssm.lambda-url.us-east-1.on.aws/"
    }
  }
}

mock_provider "cloudflare" {}

variables {
  account_id           = "0123456789abcdef0123456789abcdef"
  name_prefix          = "example"
  zone_name            = "example.com"
  power_hostname       = "power.example.com"
  access_aud_parameter = "/example/power/access_aud"
  allowed_idps         = ["00000000-0000-0000-0000-000000000000"]
  policy_ids           = ["11111111-1111-1111-1111-111111111111"]
}

run "function_url_skips_the_ssm_lookup" {
  command = plan

  variables {
    function_url = "https://abc.lambda-url.us-east-1.on.aws/"
  }

  assert {
    condition     = length(data.aws_ssm_parameter.function_url) == 0
    error_message = "With function_url set, the module must not read the SSM parameter."
  }

  assert {
    condition     = cloudflare_workers_script.power.bindings[0].text == "https://abc.lambda-url.us-east-1.on.aws/"
    error_message = "The Worker's FUNCTION_URL binding must hold the function_url input."
  }
}

run "function_url_parameter_reads_ssm" {
  command = plan

  variables {
    function_url_parameter = "/example/power/function_url"
  }

  assert {
    condition     = length(data.aws_ssm_parameter.function_url) == 1
    error_message = "With function_url_parameter set, the module must read the SSM parameter."
  }

  assert {
    condition     = data.aws_ssm_parameter.function_url[0].name == "/example/power/function_url"
    error_message = "The SSM lookup must use the function_url_parameter name."
  }

  assert {
    condition     = nonsensitive(cloudflare_workers_script.power.bindings[0].text) == "https://from-ssm.lambda-url.us-east-1.on.aws/"
    error_message = "The Worker's FUNCTION_URL binding must hold the value read from SSM."
  }
}

# A single root passes the lambda module's function_url output, which is unknown until apply.
run "unknown_function_url_still_plans" {
  command = plan

  module {
    source = "./tests/unknown_function_url"
  }
}

run "both_inputs_fail_validation" {
  command = plan

  variables {
    function_url           = "https://abc.lambda-url.us-east-1.on.aws/"
    function_url_parameter = "/example/power/function_url"
  }

  expect_failures = [var.function_url]
}

run "neither_input_fails_validation" {
  command = plan

  expect_failures = [var.function_url]
}
