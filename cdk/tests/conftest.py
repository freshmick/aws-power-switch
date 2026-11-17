import pytest
from aws_cdk.assertions import Template

from stack import synth


@pytest.fixture
def template() -> Template:
    return synth(tag_key="power-switch", reserved_concurrency=3, log_retention_days=30)
