# Step 7: push notifications.
# Kept in its own file so main.tf stays unchanged.

locals {
  # TODO: a contact address push services can use if there's a problem.
  vapid_subject = "mailto:awsbhargavi93@gmail.com"
}

module "notifications" {
  source              = "../../modules/notifications"
  name_prefix         = local.name_prefix
  items_stream_arn    = module.data.items_stream_arn
  members_table       = module.data.members_table
  subscriptions_table = module.data.push_subscriptions_table
  table_arns          = module.data.table_arns
  lambda_source_dir   = "${path.root}/../../../lambdas/notify"
  vapid_subject       = local.vapid_subject
}

output "notify_function_name" {
  value = module.notifications.function_name
}

output "vapid_public_param" {
  value = module.notifications.vapid_public_param
}

output "vapid_private_param" {
  value = module.notifications.vapid_private_param
}
