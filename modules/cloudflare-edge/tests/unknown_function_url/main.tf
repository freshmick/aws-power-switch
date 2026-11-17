# Test helper: calls the edge module with a function_url that is unknown at plan time, as it is when
# a single root passes the lambda module's function_url output straight in.

resource "terraform_data" "lambda" {
  input = "https://${md5(timestamp())}.lambda-url.us-east-1.on.aws/"
}

module "edge" {
  source = "../.."

  account_id           = "0123456789abcdef0123456789abcdef"
  name_prefix          = "example"
  zone_name            = "example.com"
  power_hostname       = "power.example.com"
  function_url         = terraform_data.lambda.output
  access_aud_parameter = "/example/power/access_aud"
  allowed_idps         = ["00000000-0000-0000-0000-000000000000"]
  policy_ids           = ["11111111-1111-1111-1111-111111111111"]
}
