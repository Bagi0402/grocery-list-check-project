terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" {
  region = "ap-southeast-2"
  default_tags {
    tags = {
      Purpose     = "grocery-list-check-project"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}