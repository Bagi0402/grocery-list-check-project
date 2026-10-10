#!/usr/bin/env bash
# Builds the React app and publishes it to S3 + CloudFront.
# Used by GitHub Actions and can be run from your laptop too.
# Needs: AWS credentials, Node, and `terraform init` already run in infra/envs/dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/infra/envs/dev"

tf_out() {
  terraform -chdir="$TF_DIR" output -raw "$1"
}

BUCKET="$(tf_out site_bucket)"
DISTRIBUTION_ID="$(tf_out cloudfront_distribution_id)"
SITE_URL="$(tf_out site_url)"

echo "Writing app/.env.local from Terraform outputs"
{
  echo "VITE_AWS_REGION=ap-southeast-2"
  echo "VITE_USER_POOL_ID=$(tf_out user_pool_id)"
  echo "VITE_USER_POOL_CLIENT_ID=$(tf_out web_client_id)"
  echo "VITE_GRAPHQL_URL=$(tf_out graphql_url)"
} > "$ROOT/app/.env.local"

echo "Building the app"
cd "$ROOT/app"
npm ci
npm run build

echo "Uploading to s3://$BUCKET"
# 1. Hashed assets first, cached for a year (their names change on every build).
aws s3 sync dist/ "s3://$BUCKET" --delete \
  --exclude "index.html" \
  --cache-control "public,max-age=31536000,immutable"

# 2. index.html last, never cached, so visitors always get the newest version.
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache"

echo "Clearing CloudFront's cached copy of index.html"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" > /dev/null

echo "Deployed: $SITE_URL"
