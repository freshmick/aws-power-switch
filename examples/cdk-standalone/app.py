"""Deploys the power switch as its own stack: one PowerSwitchStack built from cdk.json context.

`cdk deploy` runs this through the CDK CLI. `python app.py` also works on its own and synthesizes
the template without credentials or the CLI, because the app reads cdk.json itself. Context passed
on the command line (`cdk deploy -c name_prefix=...`) overrides cdk.json.
"""

import json
from pathlib import Path

import aws_cdk as cdk

from aws_power_switch_cdk import PowerSwitchStack

CDK_JSON = Path(__file__).resolve().parent / "cdk.json"

# The PowerSwitchStack keyword arguments the app takes from context; any it doesn't find keep
# their defaults.
INPUT_NAMES = (
    "name_prefix",
    "power_hostname",
    "access_team_domain_parameter",
    "access_aud_parameter",
    "function_url_parameter",
    "tag_key",
    "reserved_concurrency",
    "log_retention_days",
)


def cdk_json_context(path: Path) -> dict:
    """The "context" object of a cdk.json file."""
    return json.loads(path.read_text())["context"]


def stack_inputs(app: cdk.App) -> dict:
    """The PowerSwitchStack keyword arguments set in the app's context."""
    values = {name: app.node.try_get_context(name) for name in INPUT_NAMES}
    return {name: value for name, value in values.items() if value is not None}


def main() -> None:
    app = cdk.App(context=cdk_json_context(CDK_JSON))
    PowerSwitchStack(
        app,
        "PowerSwitch",
        description="Power switch: starts and stops tagged EC2 and RDS instances",
        **stack_inputs(app),
    )
    app.synth()


if __name__ == "__main__":
    main()
