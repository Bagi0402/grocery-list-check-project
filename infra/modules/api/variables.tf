variable "name_prefix" {
  type = string
}

variable "user_pool_id" {
  description = "Cognito user pool that signs users in to the API"
  type        = string
}

variable "tables" {
  description = "Map of data source name => DynamoDB table name"
  type        = map(string)
}

variable "table_arns" {
  description = "Map of DynamoDB table ARNs the API may read and write"
  type        = map(string)
}
