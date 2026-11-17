# The power switch: the app in this repo's app/ as a Lambda with a public Function URL, outside any
# VPC. The app checks the Access JWT itself; IAM (iam.tf) lets it start and stop only EC2 and RDS
# instances that carry var.tag_key.

data "aws_partition" "current" {}
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  name      = "${var.name_prefix}-power-switch"
  partition = data.aws_partition.current.partition
  region    = data.aws_region.current.region
  account   = data.aws_caller_identity.current.account_id
}

# --- Code: the app from this repo, so a git source pinned to a tag deploys that tag's app ------------

data "archive_file" "app" {
  type        = "zip"
  source_dir  = "${path.module}/../../app"
  excludes    = ["tests", "dev"]
  output_path = "${path.module}/.build/power-switch.zip"
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "this" {
  function_name    = local.name
  role             = aws_iam_role.this.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  memory_size      = 128
  timeout          = 15
  filename         = data.archive_file.app.output_path
  source_code_hash = data.archive_file.app.output_base64sha256

  # The Function URL is public: cap concurrency so a flood can't use up the account's shared pool.
  # null reserves no concurrency.
  reserved_concurrent_executions = var.reserved_concurrency

  environment {
    variables = {
      TAG_KEY                      = var.tag_key
      ACCESS_TEAM_DOMAIN_PARAMETER = var.access_team_domain_parameter
      ACCESS_AUD_PARAMETER         = var.access_aud_parameter
      POWER_HOSTNAME               = var.power_hostname
    }
  }

  depends_on = [aws_cloudwatch_log_group.this, aws_iam_role_policy.this]
}

# --- Function URL: public, the app itself rejects requests without a valid Access token ---------------

resource "aws_lambda_function_url" "this" {
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "url" {
  statement_id           = "FunctionUrlPublic"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Since October 2025, a public Function URL also needs InvokeFunction, limited to calls via the URL.
resource "aws_lambda_permission" "invoke" {
  statement_id             = "FunctionUrlInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.this.function_name
  principal                = "*"
  invoked_via_function_url = true
}

# --- Parameter Store: the edge reads the Function URL from here -----------------------------------------

resource "aws_ssm_parameter" "function_url" {
  name  = var.function_url_parameter
  type  = "String"
  value = aws_lambda_function_url.this.function_url
}
