resource "aws_dynamodb_table" "grocery" {
  name         = "${var.name_prefix}-grocery"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "inviteCode"
    type = "S"
  }

  global_secondary_index {
    name            = "byInviteCode"
    hash_key        = "inviteCode"
    projection_type = "ALL" # step 3: joining needs the grocery name too
  }
}

resource "aws_dynamodb_table" "members" {
  name         = "${var.name_prefix}-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "householdId"
  range_key    = "userId"

  attribute {
    name = "householdId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "byUser"
    hash_key        = "userId"
    range_key       = "householdId"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "items" {
  name             = "${var.name_prefix}-items"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "householdId"
  range_key        = "id"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES" # used by notifications in step 7

  attribute {
    name = "householdId"
    type = "S"
  }
  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "updatedAt"
    type = "S" # ISO 8601 UTC, e.g. 2026-10-08T03:45:00.000Z
  }

  global_secondary_index {
    name            = "byUpdatedAt"
    hash_key        = "householdId"
    range_key       = "updatedAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "purgeAt"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "push_subscriptions" {
  name         = "${var.name_prefix}-push-subscriptions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "endpointHash"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "endpointHash"
    type = "S"
  }
}
