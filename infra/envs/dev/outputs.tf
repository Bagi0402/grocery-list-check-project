output "user_pool_id" {
  value = module.auth.user_pool_id
}

output "web_client_id" {
  value = module.auth.web_client_id
}

output "items_table" {
  value = module.data.items_table
}

output "graphql_url" {
  value = module.api.graphql_url
}

output "realtime_url" {
  value = module.api.realtime_url
}
