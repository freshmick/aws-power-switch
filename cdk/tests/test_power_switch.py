from aws_cdk.assertions import Match

from stack import synth


def statement(template, sid):
    policy = next(iter(template.find_resources("AWS::IAM::Policy").values()))
    statements = policy["Properties"]["PolicyDocument"]["Statement"]
    return next(s for s in statements if s["Sid"] == sid)


def test_start_stop_is_conditioned_on_the_tag_key(template):
    instances = statement(template, "SwitchTaggedInstances")
    databases = statement(template, "SwitchTaggedDatabases")

    assert instances["Action"] == ["ec2:StartInstances", "ec2:StopInstances"]
    assert instances["Resource"]["Fn::Join"][1][-1] == ":instance/*"
    assert instances["Condition"] == {"Null": {"aws:ResourceTag/power-switch": "false"}}
    assert databases["Action"] == ["rds:StartDBInstance", "rds:StopDBInstance"]
    assert databases["Resource"]["Fn::Join"][1][-1] == ":db:*"
    assert databases["Condition"] == {"Null": {"rds:db-tag/power-switch": "false"}}


def test_describe_is_allowed_on_all_instances(template):
    describe = statement(template, "Describe")

    assert describe["Action"] == ["ec2:DescribeInstances", "rds:DescribeDBInstances", "rds:DescribeEvents"]
    assert describe["Resource"] == "*"


def test_ssm_read_is_limited_to_the_two_named_parameters(template):
    read = statement(template, "ReadSettings")
    arn_suffixes = [arn["Fn::Join"][1][-1] for arn in read["Resource"]]

    assert read["Action"] == "ssm:GetParameter"
    assert arn_suffixes == [
        ":parameter/example/edge/access_team_domain",
        ":parameter/example/power/access_aud",
    ]


def test_function_runs_the_app_on_node_22_arm64_with_the_inputs(template):
    template.has_resource_properties(
        "AWS::Lambda::Function",
        {
            "FunctionName": "example-power-switch",
            "Runtime": "nodejs22.x",
            "Architectures": ["arm64"],
            "Handler": "index.handler",
            "MemorySize": 128,
            "Timeout": 15,
            "ReservedConcurrentExecutions": 3,
            "Environment": {
                "Variables": {
                    "TAG_KEY": "power-switch",
                    "ACCESS_TEAM_DOMAIN_PARAMETER": "/example/edge/access_team_domain",
                    "ACCESS_AUD_PARAMETER": "/example/power/access_aud",
                    "POWER_HOSTNAME": "power.example.com",
                }
            },
        },
    )
    template.has_resource_properties(
        "AWS::Logs::LogGroup",
        {"LogGroupName": "/aws/lambda/example-power-switch", "RetentionInDays": 30},
    )


def test_function_url_has_auth_none_and_is_written_to_the_named_parameter(template):
    url_id = next(iter(template.find_resources("AWS::Lambda::Url", {"Properties": {"AuthType": "NONE"}})))

    template.has_resource_properties(
        "AWS::SSM::Parameter",
        {"Name": "/example/power/function_url", "Value": {"Fn::GetAtt": [url_id, "FunctionUrl"]}},
    )
    template.has_resource_properties(
        "AWS::Lambda::Permission",
        {"Action": "lambda:InvokeFunction", "Principal": "*", "InvokedViaFunctionUrl": True},
    )


def test_defaults_match_the_terraform_module():
    template = synth()

    template.has_resource_properties(
        "AWS::Lambda::Function",
        {
            "ReservedConcurrentExecutions": 2,
            "Environment": {"Variables": Match.object_like({"TAG_KEY": "power-switch"})},
        },
    )
    template.has_resource_properties("AWS::Logs::LogGroup", {"RetentionInDays": 14})
