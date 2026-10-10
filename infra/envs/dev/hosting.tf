# Step 5: website hosting and GitHub Actions access.
# Kept in its own file so main.tf stays unchanged.

locals {
  github_repo = "Bagi0402/grocery-list-check-project"
}

module "hosting" {
  source      = "../../modules/hosting"
  name_prefix = local.name_prefix
}

module "github_ci" {
  source      = "../../modules/github-ci"
  name_prefix = local.name_prefix
  github_repo = local.github_repo
}

output "site_bucket" {
  value = module.hosting.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.hosting.distribution_id
}

output "site_url" {
  value = "https://${module.hosting.domain_name}"
}

output "deploy_role_arn" {
  value = module.github_ci.deploy_role_arn
}

output "plan_role_arn" {
  value = module.github_ci.plan_role_arn
}
