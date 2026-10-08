terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { 
        source = "hashicorp/aws" 
        version = "~> 6.0" }
  }
}

provider "aws" { region = "ap-southeast-2" }

data "aws_caller_identity" "bagi" {}

resource "aws_s3_bucket" "devenv" {
  bucket = "gcl-devenv-${data.aws_caller_identity.bagi.account_id}"
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_versioning" "devenv" {
  bucket = aws_s3_bucket.devenv.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "devenv" {
  bucket = aws_s3_bucket.devenv.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "devenv" {
  bucket                  = aws_s3_bucket.devenv.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket" { 
    value = aws_s3_bucket.devenv.bucket 
}