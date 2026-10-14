variable "name_prefix" {
  type = string
}

variable "region" {
  description = "Region the app runs in (used by dashboard widgets)"
  type        = string
}

variable "alert_email" {
  description = "Where alarm emails are sent"
  type        = string
}

variable "appsync_api_id" {
  type = string
}

variable "notify_function_name" {
  type = string
}

variable "items_table" {
  type = string
}
