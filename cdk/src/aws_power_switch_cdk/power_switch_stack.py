"""PowerSwitchStack: the PowerSwitch construct deployed as its own stack.

Takes the same keyword arguments, with the same defaults, as PowerSwitch; any other keyword
argument (env, description, ...) goes to Stack. Outputs the Function URL.
"""

from typing import Any

from aws_cdk import CfnOutput, Stack
from constructs import Construct

from aws_power_switch_cdk.power_switch import PowerSwitch


class PowerSwitchStack(Stack):
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
        **stack_kwargs: Any,
    ) -> None:
        super().__init__(scope, construct_id, **stack_kwargs)

        self.power_switch = PowerSwitch(
            self,
            "PowerSwitch",
            name_prefix=name_prefix,
            power_hostname=power_hostname,
            access_team_domain_parameter=access_team_domain_parameter,
            access_aud_parameter=access_aud_parameter,
            function_url_parameter=function_url_parameter,
            tag_key=tag_key,
            reserved_concurrency=reserved_concurrency,
            log_retention_days=log_retention_days,
        )
        CfnOutput(
            self,
            "FunctionUrl",
            value=self.power_switch.function_url,
            description="The power switch Lambda's Function URL",
        )
