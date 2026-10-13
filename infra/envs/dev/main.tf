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

locals {
  name_prefix = "gcl-dev"
}

module "auth" {
  source      = "../../modules/auth"
  name_prefix = local.name_prefix
}

module "data" {
  source      = "../../modules/data"
  name_prefix = local.name_prefix
}

module "api" {
  source       = "../../modules/api"
  name_prefix  = local.name_prefix
  user_pool_id = module.auth.user_pool_id

  tables = {
    grocery = module.data.grocery_table
    members = module.data.members_table
    items   = module.data.items_table
    push_subscriptions = module.data.push_subscriptions_table
  }
  table_arns = module.data.table_arns
}
