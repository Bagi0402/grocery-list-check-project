# Everything here fits in the CloudWatch / SNS free tiers:
# 5 alarms (10 free), 1 dashboard (3 free), 3 custom metrics (10 free).

locals {
  metrics_namespace = "GroceryList"
  dashboard_name    = "${var.name_prefix}-overview"
}

# ---------------------------------------------------------------------------
# Where alerts go
# ---------------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"
}

# AWS emails a confirmation link; alerts start after you click it.
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---------------------------------------------------------------------------
# Alarms
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${var.name_prefix}-api-server-errors"
  alarm_description   = "AppSync returned server errors (5XX). Check the API's CloudWatch logs."
  namespace           = "AWS/AppSync"
  metric_name         = "5XXError"
  dimensions          = { GraphQLAPIId = var.appsync_api_id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.name_prefix}-api-slow"
  alarm_description   = "90% of API requests should finish within 1.5 seconds."
  namespace           = "AWS/AppSync"
  metric_name         = "Latency"
  dimensions          = { GraphQLAPIId = var.appsync_api_id }
  extended_statistic  = "p90"
  period              = 300
  evaluation_periods  = 2
  threshold           = 1500
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "notify_errors" {
  alarm_name          = "${var.name_prefix}-notify-errors"
  alarm_description   = "The push-notification Lambda failed. Check /aws/lambda/${var.notify_function_name}."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = var.notify_function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

# If the Lambda falls behind the stream, notifications arrive late.
resource "aws_cloudwatch_metric_alarm" "notify_lag" {
  alarm_name          = "${var.name_prefix}-notify-lagging"
  alarm_description   = "Item changes are waiting more than 5 minutes to be processed for notifications."
  namespace           = "AWS/Lambda"
  metric_name         = "IteratorAge"
  dimensions          = { FunctionName = var.notify_function_name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 300000 # milliseconds
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}

# Custom metric emitted by the Lambda (Embedded Metric Format).
resource "aws_cloudwatch_metric_alarm" "push_failures" {
  alarm_name          = "${var.name_prefix}-push-failures"
  alarm_description   = "Five or more push notifications failed to send within an hour."
  namespace           = local.metrics_namespace
  metric_name         = "NotificationsFailed"
  dimensions          = { Function = var.notify_function_name }
  statistic           = "Sum"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
locals {
  alarm_arns = [
    aws_cloudwatch_metric_alarm.api_5xx.arn,
    aws_cloudwatch_metric_alarm.api_latency.arn,
    aws_cloudwatch_metric_alarm.notify_errors.arn,
    aws_cloudwatch_metric_alarm.notify_lag.arn,
    aws_cloudwatch_metric_alarm.push_failures.arn,
  ]
}

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "text", x = 0, y = 0, width = 24, height = 2
        properties = {
          markdown = "# Shared Grocery List (${var.name_prefix})\nAPI traffic and errors, live connections, push notifications and recent notification logs."
        }
      },
      {
        type = "alarm", x = 0, y = 2, width = 24, height = 3
        properties = { title = "Alarms", alarms = local.alarm_arns }
      },
      {
        type = "metric", x = 0, y = 5, width = 12, height = 6
        properties = {
          title  = "API requests and errors"
          region = var.region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/AppSync", "Latency", "GraphQLAPIId", var.appsync_api_id, { stat = "SampleCount", label = "Requests" }],
            ["AWS/AppSync", "4XXError", "GraphQLAPIId", var.appsync_api_id, { stat = "Sum", label = "Client errors (4XX)" }],
            ["AWS/AppSync", "5XXError", "GraphQLAPIId", var.appsync_api_id, { stat = "Sum", label = "Server errors (5XX)" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 5, width = 12, height = 6
        properties = {
          title  = "API latency (ms)"
          region = var.region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/AppSync", "Latency", "GraphQLAPIId", var.appsync_api_id, { stat = "p50", label = "p50" }],
            ["AWS/AppSync", "Latency", "GraphQLAPIId", var.appsync_api_id, { stat = "p90", label = "p90" }],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 11, width = 12, height = 6
        properties = {
          title  = "Live updates (WebSocket)"
          region = var.region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/AppSync", "ActiveConnections", "GraphQLAPIId", var.appsync_api_id, { stat = "Maximum", label = "Open connections" }],
            ["AWS/AppSync", "ActiveSubscriptions", "GraphQLAPIId", var.appsync_api_id, { stat = "Maximum", label = "Active subscriptions" }],
            ["AWS/AppSync", "PublishDataMessageSuccess", "GraphQLAPIId", var.appsync_api_id, { stat = "Sum", label = "Updates delivered" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 11, width = 12, height = 6
        properties = {
          title  = "Push notifications"
          region = var.region
          view   = "timeSeries"
          period = 300
          stat   = "Sum"
          metrics = [
            [local.metrics_namespace, "NotificationsSent", "Function", var.notify_function_name, { label = "Sent" }],
            [local.metrics_namespace, "NotificationsFailed", "Function", var.notify_function_name, { label = "Failed" }],
            [local.metrics_namespace, "ExpiredSubscriptionsRemoved", "Function", var.notify_function_name, { label = "Expired devices removed" }],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 17, width = 12, height = 6
        properties = {
          title  = "Notify Lambda"
          region = var.region
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.notify_function_name, { stat = "Sum", label = "Invocations" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.notify_function_name, { stat = "Sum", label = "Errors" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.notify_function_name, { stat = "p95", label = "Duration p95 (ms)", yAxis = "right" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 17, width = 12, height = 6
        properties = {
          title  = "Items table activity"
          region = var.region
          view   = "timeSeries"
          period = 300
          stat   = "Sum"
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.items_table, { label = "Writes" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.items_table, { label = "Reads" }],
          ]
        }
      },
      {
        type = "log", x = 0, y = 23, width = 24, height = 6
        properties = {
          title  = "Recent notification activity"
          region = var.region
          view   = "table"
          query  = "SOURCE '/aws/lambda/${var.notify_function_name}' | fields @timestamp, @message | filter @message like /Processed|Push failed|Removed expired/ | sort @timestamp desc | limit 20"
        }
      },
    ]
  })
}
