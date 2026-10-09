output "api_id" {
  value = aws_appsync_graphql_api.this.id
}

output "graphql_url" {
  value = aws_appsync_graphql_api.this.uris["GRAPHQL"]
}

output "realtime_url" {
  value = aws_appsync_graphql_api.this.uris["REALTIME"]
}
