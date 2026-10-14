# Monitoring: alarms, dashboard and alert emails.
# Kept in its own file so main.tf stays unchanged.

locals {
  # TODO: where alarm emails should go.
  alert_email = "awsbhargavi93@gmail.com"
}

module "monitoring" {
  source               = "../../modules/monitoring"
  name_prefix          = local.name_prefix
  region               = "ap-southeast-2"
  alert_email          = local.alert_email
  appsync_api_id       = module.api.api_id
  notify_function_name = module.notifications.function_name
  items_table          = module.data.items_table
}

output "dashboard_url" {
  value = module.monitoring.dashboard_url
}
