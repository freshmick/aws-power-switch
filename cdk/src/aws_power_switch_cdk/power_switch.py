"""PowerSwitch: the power switch app as a Lambda with a public Function URL, outside any VPC.

Creates the same resources as the Terraform lambda module, with the same inputs and defaults.
The Function URL has auth NONE; the app itself rejects requests without a valid Access token.
"""

from aws_cdk import ArnFormat, Duration, Stack
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_ssm as ssm
from constructs import Construct

from aws_power_switch_cdk.app_source import APP_DIR
from aws_power_switch_cdk.iam import power_switch_statements


class PowerSwitch(Construct):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        name_prefix: str,
        power_hostname: str,
        access_team_domain_parameter: str,
        access_aud_parameter: str,
        function_url_parameter: str,
        tag_key: str = "power-switch",
        reserved_concurrency: int | None = 2,
        log_retention_days: int = 14,
    ) -> None:
        super().__init__(scope, construct_id)
        name = f"{name_prefix}-power-switch"

        log_group = logs.CfnLogGroup(
            self, "LogGroup", log_group_name=f"/aws/lambda/{name}", retention_in_days=log_retention_days
        )
        role = iam.Role(
            self, "Role", role_name=name, assumed_by=iam.ServicePrincipal("lambda.amazonaws.com")
        )
        policy = iam.Policy(
            self,
            "Policy",
            policy_name=name,
            roles=[role],
            statements=power_switch_statements(
                tag_key=tag_key,
                instances_arn=Stack.of(self).format_arn(
                    service="ec2", resource="instance", resource_name="*"
                ),
                databases_arn=Stack.of(self).format_arn(
                    service="rds",
                    resource="db",
                    resource_name="*",
                    arn_format=ArnFormat.COLON_RESOURCE_NAME,
                ),
                parameter_arns=[
                    self._parameter_arn(access_team_domain_parameter),
                    self._parameter_arn(access_aud_parameter),
                ],
                log_group_arn=log_group.attr_arn,
            ),
        )

        self.function = lambda_.Function(
            self,
            "Function",
            function_name=name,
            role=role,
            runtime=lambda_.Runtime.NODEJS_22_X,
            architecture=lambda_.Architecture.ARM_64,
            handler="index.handler",
            memory_size=128,
            timeout=Duration.seconds(15),
            code=lambda_.Code.from_asset(str(APP_DIR)),
            # The Function URL is public: cap concurrency so a flood can't use up the account's pool.
            # None reserves no concurrency.
            reserved_concurrent_executions=reserved_concurrency,
            environment={
                "TAG_KEY": tag_key,
                "ACCESS_TEAM_DOMAIN_PARAMETER": access_team_domain_parameter,
                "ACCESS_AUD_PARAMETER": access_aud_parameter,
                "POWER_HOSTNAME": power_hostname,
            },
        )
        self.function.node.add_dependency(log_group, policy)

        url = self.function.add_function_url(auth_type=lambda_.FunctionUrlAuthType.NONE)
        self.function_url = url.url
        ssm.StringParameter(
            self, "FunctionUrlParameter", parameter_name=function_url_parameter, string_value=url.url
        )

    def _parameter_arn(self, parameter_name: str) -> str:
        return Stack.of(self).format_arn(
            service="ssm", resource="parameter", resource_name=parameter_name.lstrip("/")
        )
