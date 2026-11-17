"""Builds the test stack every test synthesizes."""

import aws_cdk as cdk
from aws_cdk.assertions import Template

from aws_power_switch_cdk import PowerSwitch

REQUIRED_INPUTS = {
    "name_prefix": "example",
    "power_hostname": "power.example.com",
    "access_team_domain_parameter": "/example/edge/access_team_domain",
    "access_aud_parameter": "/example/power/access_aud",
    "function_url_parameter": "/example/power/function_url",
}


def synth(**inputs) -> Template:
    """Synthesizes a stack holding one PowerSwitch; inputs override REQUIRED_INPUTS."""
    stack = cdk.Stack(cdk.App(), "TestStack")
    PowerSwitch(stack, "PowerSwitch", **{**REQUIRED_INPUTS, **inputs})
    return Template.from_stack(stack)
