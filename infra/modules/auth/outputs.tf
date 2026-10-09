output "user_pool_id" { value = aws_cognito_user_pool.up.id }
output "user_pool_arn" { value = aws_cognito_user_pool.up.arn }
output "web_client_id" { value = aws_cognito_user_pool_client.web.id }
