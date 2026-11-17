"""reserved_concurrency=None deploys the function with no reserved concurrency."""

import aws_cdk as cdk
from aws_cdk.assertions import Template

from aws_power_switch_cdk import PowerSwitchStack
from stack import REQUIRED_INPUTS, synth


def function_properties(template: Template) -> dict:
    function = next(iter(template.find_resources("AWS::Lambda::Function").values()))
    return function["Properties"]


def test_construct_with_none_reserves_no_concurrency():
    template = synth(reserved_concurrency=None)

    assert "ReservedConcurrentExecutions" not in function_properties(template)


def test_stack_with_none_reserves_no_concurrency():
    stack = PowerSwitchStack(cdk.App(), "PowerSwitch", **REQUIRED_INPUTS, reserved_concurrency=None)

    assert "ReservedConcurrentExecutions" not in function_properties(Template.from_stack(stack))
