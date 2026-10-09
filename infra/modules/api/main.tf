# ---------------------------------------------------------------------------
# GraphQL API (sign-in with Cognito)
# ---------------------------------------------------------------------------
resource "aws_appsync_graphql_api" "this" {
  name                = "${var.name_prefix}-api"
  authentication_type = "AMAZON_COGNITO_USER_POOLS"
  schema              = file("${path.module}/schema.graphql")

  user_pool_config {
    user_pool_id   = var.user_pool_id
    default_action = "ALLOW"
  }

  log_config {
    cloudwatch_logs_role_arn = aws_iam_role.logs.arn
    field_log_level          = "ERROR"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/appsync/apis/${aws_appsync_graphql_api.this.id}"
  retention_in_days = 14
}

# ---------------------------------------------------------------------------
# IAM: AppSync -> CloudWatch Logs
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "appsync_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["appsync.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "logs" {
  name               = "${var.name_prefix}-appsync-logs"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs"
}

# ---------------------------------------------------------------------------
# IAM: AppSync -> DynamoDB (least privilege: only the actions we use)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "dynamodb" {
  name               = "${var.name_prefix}-appsync-dynamodb"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

data "aws_iam_policy_document" "dynamodb" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = flatten([
      for arn in values(var.table_arns) : [arn, "${arn}/index/*"]
    ])
  }
}

resource "aws_iam_role_policy" "dynamodb" {
  name   = "dynamodb-access"
  role   = aws_iam_role.dynamodb.id
  policy = data.aws_iam_policy_document.dynamodb.json
}

# ---------------------------------------------------------------------------
# Data sources: one per table
# ---------------------------------------------------------------------------
resource "aws_appsync_datasource" "ddb" {
  for_each = var.tables

  api_id           = aws_appsync_graphql_api.this.id
  name             = each.key
  type             = "AMAZON_DYNAMODB"
  service_role_arn = aws_iam_role.dynamodb.arn

  dynamodb_config {
    table_name = each.value
  }
}

# ---------------------------------------------------------------------------
# Functions: small reusable steps (function name => data source)
# ---------------------------------------------------------------------------
locals {
  functions = {
    checkMembership       = "members"
    createHousehold       = "grocery"
    findHouseholdByInvite = "grocery"
    putMember             = "members"
    myHouseholds          = "members"
    listMembers           = "members"
    listItems             = "items"
    itemsChangedSince     = "items"
    upsertItem            = "items"
    deleteItem            = "items"
  }

  # Each GraphQL field runs a pipeline of functions, in order.
  resolvers = {
    "Query.myHouseholds"         = ["myHouseholds"]
    "Query.householdMembers"     = ["checkMembership", "listMembers"]
    "Query.listItems"            = ["checkMembership", "listItems"]
    "Query.itemsChangedSince"    = ["checkMembership", "itemsChangedSince"]
    "Mutation.createHousehold"   = ["createHousehold", "putMember"]
    "Mutation.joinHousehold"     = ["findHouseholdByInvite", "putMember"]
    "Mutation.upsertItem"        = ["checkMembership", "upsertItem"]
    "Mutation.deleteItem"        = ["checkMembership", "deleteItem"]
    "Subscription.onItemChanged" = ["checkMembership"]
  }
}

resource "aws_appsync_function" "fn" {
  for_each = local.functions

  api_id      = aws_appsync_graphql_api.this.id
  name        = each.key
  data_source = aws_appsync_datasource.ddb[each.value].name
  code        = file("${path.module}/resolvers/functions/${each.key}.js")

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }
}

resource "aws_appsync_resolver" "this" {
  for_each = local.resolvers

  api_id = aws_appsync_graphql_api.this.id
  type   = split(".", each.key)[0]
  field  = split(".", each.key)[1]
  kind   = "PIPELINE"
  code = (
    split(".", each.key)[0] == "Subscription"
    ? file("${path.module}/resolvers/subscription.js")
    : file("${path.module}/resolvers/pipeline.js")
  )

  runtime {
    name            = "APPSYNC_JS"
    runtime_version = "1.0.0"
  }

  pipeline_config {
    functions = [for f in each.value : aws_appsync_function.fn[f].function_id]
  }
}
