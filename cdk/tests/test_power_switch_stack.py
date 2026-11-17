"""PowerSwitchStack: the PowerSwitch construct as its own stack, with the Function URL as an output.

After an intended change, regenerate the snapshot with UPDATE_SNAPSHOT=1 and commit it in the same PR.
"""

import json
import os
from pathlib import Path

import aws_cdk as cdk
from aws_cdk.assertions import Template

from aws_power_switch_cdk import PowerSwitch, PowerSwitchStack
from test_snapshot import ASSET_HASH

SNAPSHOT = Path(__file__).parent / "snapshots" / "power_switch_stack.template.json"
INPUTS = {
    "name_prefix": "example",
    "power_hostname": "power.example.com",
    "access_team_domain_parameter": "/example/access_team_domain",
    "access_aud_parameter": "/example/power/access_aud",
    "function_url_parameter": "/example/power/function_url",
}


def make_stack(**stack_kwargs) -> PowerSwitchStack:
    return PowerSwitchStack(cdk.App(), "PowerSwitch", **INPUTS, **stack_kwargs)


def normalized(template: Template) -> str:
    rendered = json.dumps(template.to_json(), indent=2, sort_keys=True) + "\n"
    return ASSET_HASH.sub("<asset-hash>", rendered)


def test_template_matches_snapshot():
    actual = normalized(Template.from_stack(make_stack()))
    if os.environ.get("UPDATE_SNAPSHOT") == "1":
        SNAPSHOT.write_text(actual)

    expected = SNAPSHOT.read_text() if SNAPSHOT.exists() else ""
    assert actual == expected, "template changed; rerun with UPDATE_SNAPSHOT=1 and commit the snapshot"


def test_outputs_the_function_url():
    template = Template.from_stack(make_stack())
    url_id = next(iter(template.find_resources("AWS::Lambda::Url")))

    template.has_output("*", {"Value": {"Fn::GetAtt": [url_id, "FunctionUrl"]}})


def test_passes_standard_stack_options_to_stack():
    stack = make_stack(
        env=cdk.Environment(account="123456789012", region="eu-west-1"),
        description="example power switch",
    )

    assert (stack.account, stack.region) == ("123456789012", "eu-west-1")
    assert Template.from_stack(stack).to_json()["Description"] == "example power switch"


def test_exposes_the_construct():
    stack = make_stack()

    assert isinstance(stack.power_switch, PowerSwitch)
    assert stack.power_switch.node.scope is stack
