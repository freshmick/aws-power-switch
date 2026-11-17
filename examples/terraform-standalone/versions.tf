# No backend block: state stays local, which is fine for trying the example. For real use, keep
# state in a remote S3 backend instead, e.g.
#
#   backend "s3" {
#     bucket       = "example-terraform-state"
#     key          = "power-switch/terraform.tfstate"
#     region       = "us-east-1"
#     use_lockfile = true
#   }

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

# Credentials come from the environment: the usual AWS credential chain, and CLOUDFLARE_API_TOKEN.
provider "aws" {
  region = var.region
}

provider "cloudflare" {}
