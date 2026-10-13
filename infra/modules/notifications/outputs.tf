output "function_name" {
  value = aws_lambda_function.notify.function_name
}

output "vapid_public_param" {
  value = local.vapid_public_param
}

output "vapid_private_param" {
  value = local.vapid_private_param
}
