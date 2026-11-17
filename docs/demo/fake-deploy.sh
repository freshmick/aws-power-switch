# Sourced by deploy.tape. Stands in for the commands of the Terraform standalone install so the
# recording needs no AWS or Cloudflare account: nothing here runs Terraform or changes a file.
# The output is canned and shortened; the resource addresses are the ones the example creates.
PS1='$ '

cd() { :; }
cp() { :; }

terraform() {
  case "$1" in
    init) fake_init ;;
    apply) fake_apply ;;
  esac
}

fake_init() {
  echo 'Initializing modules...'
  echo 'Initializing provider plugins...'
  sleep 0.6
  echo
  echo 'Terraform has been successfully initialized!'
}

fake_created() {
  for address in "$@"; do
    sleep 0.25
    echo "$address: Creation complete"
  done
}

fake_apply() {
  echo
  echo 'Plan: 14 to add, 0 to change, 0 to destroy.'
  echo
  echo 'Do you want to perform these actions?'
  printf '  Enter a value: '
  read -r _answer
  echo
  fake_created \
    aws_ssm_parameter.access_team_domain \
    cloudflare_zero_trust_access_policy.allowed_emails \
    module.power_switch.aws_cloudwatch_log_group.this \
    module.power_switch.aws_iam_role.this \
    module.power_switch.aws_iam_role_policy.this \
    module.power_switch.aws_lambda_function.this \
    module.power_switch.aws_lambda_function_url.this \
    module.power_switch.aws_lambda_permission.url \
    module.power_switch.aws_lambda_permission.invoke \
    module.power_switch.aws_ssm_parameter.function_url \
    module.power_switch_edge.cloudflare_workers_script.power \
    module.power_switch_edge.cloudflare_workers_custom_domain.power \
    module.power_switch_edge.cloudflare_zero_trust_access_application.power \
    module.power_switch_edge.aws_ssm_parameter.access_aud
  echo
  echo 'Apply complete! Resources: 14 added, 0 changed, 0 destroyed.'
  echo
  echo 'Outputs:'
  echo
  echo 'function_url = "https://abcdefghijklmnopqrstuvwxyz012345.lambda-url.us-east-1.on.aws/"'
  echo 'power_switch_url = "https://power.example.com"'
}
