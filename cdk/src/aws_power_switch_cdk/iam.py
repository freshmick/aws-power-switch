"""The Lambda's IAM policy: least privilege.

It can describe every EC2 and RDS instance, but start and stop only those carrying the tag
key, read only the two named SSM parameters and write only its own logs.
"""

from aws_cdk import aws_iam as iam


def power_switch_statements(
    *,
    tag_key: str,
    instances_arn: str,
    databases_arn: str,
    parameter_arns: list[str],
    log_group_arn: str,
) -> list[iam.PolicyStatement]:
    return [
        describe_statement(),
        switch_instances_statement(tag_key, instances_arn),
        switch_databases_statement(tag_key, databases_arn),
        read_settings_statement(parameter_arns),
        own_logs_statement(log_group_arn),
    ]


def describe_statement() -> iam.PolicyStatement:
    # Listing actions support no resource-level scoping; the app filters by tag itself.
    return iam.PolicyStatement(
        sid="Describe",
        actions=["ec2:DescribeInstances", "rds:DescribeDBInstances", "rds:DescribeEvents"],
        resources=["*"],
    )


def switch_instances_statement(tag_key: str, instances_arn: str) -> iam.PolicyStatement:
    return iam.PolicyStatement(
        sid="SwitchTaggedInstances",
        actions=["ec2:StartInstances", "ec2:StopInstances"],
        resources=[instances_arn],
        conditions={"Null": {f"aws:ResourceTag/{tag_key}": "false"}},
    )


def switch_databases_statement(tag_key: str, databases_arn: str) -> iam.PolicyStatement:
    return iam.PolicyStatement(
        sid="SwitchTaggedDatabases",
        actions=["rds:StartDBInstance", "rds:StopDBInstance"],
        resources=[databases_arn],
        conditions={"Null": {f"rds:db-tag/{tag_key}": "false"}},
    )


def read_settings_statement(parameter_arns: list[str]) -> iam.PolicyStatement:
    return iam.PolicyStatement(
        sid="ReadSettings",
        actions=["ssm:GetParameter"],
        resources=parameter_arns,
    )


def own_logs_statement(log_group_arn: str) -> iam.PolicyStatement:
    return iam.PolicyStatement(
        sid="OwnLogs",
        actions=["logs:CreateLogStream", "logs:PutLogEvents"],
        resources=[f"{log_group_arn}:*"],
    )
