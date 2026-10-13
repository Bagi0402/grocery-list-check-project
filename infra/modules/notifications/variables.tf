variable "name_prefix" {
  type = string
}

variable "items_stream_arn" {
  description = "DynamoDB stream of the items table"
  type        = string
}

variable "members_table" {
  type = string
}

variable "subscriptions_table" {
  type = string
}

variable "table_arns" {
  description = "Map of table ARNs from the data module (uses members and push_subscriptions)"
  type        = map(string)
}

variable "lambda_source_dir" {
  description = "Folder containing the Lambda code and its node_modules"
  type        = string
}

variable "vapid_subject" {
  description = "Contact for push services, as mailto:you@example.com or an https URL"
  type        = string
}
