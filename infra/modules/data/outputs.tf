output "grocery_table" { value = aws_dynamodb_table.grocery.name }
output "members_table" { value = aws_dynamodb_table.members.name }
output "items_table" { value = aws_dynamodb_table.items.name }
output "push_subscriptions_table" { value = aws_dynamodb_table.push_subscriptions.name }

output "table_arns" {
  value = {
    households         = aws_dynamodb_table.grocery.arn
    members            = aws_dynamodb_table.members.arn
    items              = aws_dynamodb_table.items.arn
    push_subscriptions = aws_dynamodb_table.push_subscriptions.arn
  }
}

output "items_stream_arn" { value = aws_dynamodb_table.items.stream_arn }
