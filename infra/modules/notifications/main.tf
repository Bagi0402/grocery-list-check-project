terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  function_name       = "${var.name_prefix}-notify"
  vapid_public_param  = "/${var.name_prefix}/vapid/public-key"
  vapid_private_param = "/${var.name_prefix}/vapid/private-key"
}

# ---------------------------------------------------------------------------
# Package the Lambda (run `npm ci --omit=dev` in lambdas/notify first)
# ---------------------------------------------------------------------------
data "archive_file" "notify" {
  type             = "zip"
  source_dir       = var.lambda_source_dir
  output_path      = "${var.lambda_source_dir}/../.build/notify.zip"
  output_file_mode = "0666" # same zip hash on macOS and in CI
}

# ---------------------------------------------------------------------------
# IAM: only what the function needs
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "notify" {
  name               = local.function_name
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.notify.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "xray" {
  role       = aws_iam_role.notify.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

data "aws_iam_policy_document" "notify" {
  statement {
    sid = "ReadItemChanges"
    actions = [
      "dynamodb:DescribeStream",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:ListStreams",
    ]
    resources = [var.items_stream_arn]
  }

  statement {
    sid       = "ReadMembers"
    actions   = ["dynamodb:Query"]
    resources = [var.table_arns["members"]]
  }

  statement {
    sid       = "ManageSubscriptions"
    actions   = ["dynamodb:Query", "dynamodb:DeleteItem"]
    resources = [var.table_arns["push_subscriptions"]]
  }

  statement {
    sid       = "ReadVapidKeys"
    actions   = ["ssm:GetParameters"]
    resources = ["arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/${var.name_prefix}/vapid/*"]
  }
}

resource "aws_iam_role_policy" "notify" {
  name   = "notify-access"
  role   = aws_iam_role.notify.id
  policy = data.aws_iam_policy_document.notify.json
}

# ---------------------------------------------------------------------------
# Function
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "notify" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "notify" {
  function_name    = local.function_name
  description      = "Sends push notifications when a shared list changes"
  role             = aws_iam_role.notify.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  architectures    = ["arm64"] # cheaper, and web-push has no native code
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.notify.output_path
  source_code_hash = data.archive_file.notify.output_base64sha256

  # X-Ray: see each invocation's calls to DynamoDB, SSM and push services.
  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      MEMBERS_TABLE       = var.members_table
      SUBSCRIPTIONS_TABLE = var.subscriptions_table
      VAPID_PUBLIC_PARAM  = local.vapid_public_param
      VAPID_PRIVATE_PARAM = local.vapid_private_param
      VAPID_SUBJECT       = var.vapid_subject
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.notify,
    aws_iam_role_policy_attachment.logs,
    aws_iam_role_policy_attachment.xray,
  ]
}

# Feed item changes to the function. Waiting up to 5 seconds lets a burst of
# edits arrive as one batch, so people get one notification instead of many.
resource "aws_lambda_event_source_mapping" "items" {
  event_source_arn                   = var.items_stream_arn
  function_name                      = aws_lambda_function.notify.arn
  starting_position                  = "LATEST"
  batch_size                         = 50
  maximum_batching_window_in_seconds = 5
  maximum_retry_attempts             = 2
  bisect_batch_on_function_error     = true

  # Ignore TTL clean-ups (REMOVE events); only new or changed items matter.
  filter_criteria {
    filter {
      pattern = jsonencode({ eventName = ["INSERT", "MODIFY"] })
    }
  }

  depends_on = [aws_iam_role_policy.notify]
}
