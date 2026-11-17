# Terraform standalone example

The whole power switch as its own stack: one `terraform apply` creates the Lambda, the Cloudflare Worker, the Access application and an Access policy allowing `allowed_emails`. It also looks up your Access team domain and stores it in SSM for the Lambda. It uses the modules from this clone (`../../modules/...`).

Steps and inputs: [Terraform standalone](../../README.md#terraform-standalone) in the main README. Start from [`terraform.tfvars.example`](terraform.tfvars.example).

There's no backend block, so state stays local. For real use, add a remote S3 backend; [`versions.tf`](versions.tf) shows one.
