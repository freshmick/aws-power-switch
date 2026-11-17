# The function's IAM role, least privilege: describe all EC2/RDS instances (listing supports no
# resource scoping; the app filters by tag itself), start/stop only EC2/RDS instances carrying
# var.tag_key (any value), read only the two Access parameters, and write only its own logs.

locals {
  # SSM parameter ARNs drop the name's leading slash: arn:...:parameter/a/b for "/a/b".
  ssm_parameter_arn = "arn:${local.partition}:ssm:${local.region}:${local.account}:parameter"
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = local.name
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "this" {
  statement {
    sid       = "Describe"
    actions   = ["ec2:DescribeInstances", "rds:DescribeDBInstances", "rds:DescribeEvents"]
    resources = ["*"]
  }

  statement {
    sid       = "SwitchTaggedInstances"
    actions   = ["ec2:StartInstances", "ec2:StopInstances"]
    resources = ["arn:${local.partition}:ec2:${local.region}:${local.account}:instance/*"]
    condition {
      test     = "Null"
      variable = "aws:ResourceTag/${var.tag_key}"
      values   = ["false"]
    }
  }

  statement {
    sid       = "SwitchTaggedDatabases"
    actions   = ["rds:StartDBInstance", "rds:StopDBInstance"]
    resources = ["arn:${local.partition}:rds:${local.region}:${local.account}:db:*"]
    condition {
      test     = "Null"
      variable = "rds:db-tag/${var.tag_key}"
      values   = ["false"]
    }
  }

  statement {
    sid     = "ReadAccessSettings"
    actions = ["ssm:GetParameter"]
    resources = [
      "${local.ssm_parameter_arn}/${trimprefix(var.access_team_domain_parameter, "/")}",
      "${local.ssm_parameter_arn}/${trimprefix(var.access_aud_parameter, "/")}",
    ]
  }

  statement {
    sid       = "OwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.this.arn}:*"]
  }
}

resource "aws_iam_role_policy" "this" {
  name   = local.name
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.this.json
}
