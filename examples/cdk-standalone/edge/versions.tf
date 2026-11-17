# No backend block: state stays in a local terraform.tfstate, which is fine for trying the example.
# For real use, keep state in a remote S3 backend (with locking) instead, so it isn't only on one
# laptop: https://developer.hashicorp.com/terraform/language/backend/s3

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Credentials and the region come from the environment: AWS_PROFILE or the AWS_* keys, plus
# AWS_REGION set to the region the CDK stack was deployed to; CLOUDFLARE_API_TOKEN for Cloudflare.
provider "aws" {}

provider "cloudflare" {}
