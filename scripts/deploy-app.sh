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

# Public VAPID key for push notifications (created by scripts/setup-vapid.sh).
VAPID_PUBLIC_KEY="$(aws ssm get-parameter --name "$(tf_out vapid_public_param)" \
  --query Parameter.Value --output text 2>/dev/null || true)"
if [ -z "$VAPID_PUBLIC_KEY" ]; then
  echo "Note: no VAPID keys yet (run scripts/setup-vapid.sh); notifications will be hidden in the app."
fi

echo "Writing app/.env.local from Terraform outputs"
{
  echo "VITE_AWS_REGION=ap-southeast-2"
  echo "VITE_USER_POOL_ID=$(tf_out user_pool_id)"
  echo "VITE_USER_POOL_CLIENT_ID=$(tf_out web_client_id)"
  echo "VITE_GRAPHQL_URL=$(tf_out graphql_url)"
  echo "VITE_VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY"
} > "$ROOT/app/.env.local"

echo "Building the app"
cd "$ROOT/app"
npm ci
npm run build

# Files that must always be fetched fresh, so new versions reach users:
# the page itself, the service worker and its registration, and the manifest.
NO_CACHE_FILES=(index.html sw.js registerSW.js manifest.webmanifest push-sw.js)

EXCLUDES=()
for f in "${NO_CACHE_FILES[@]}"; do
  EXCLUDES+=(--exclude "$f")
done

echo "Uploading to s3://$BUCKET"
# 1. Hashed assets first, cached for a year (their names change on every build).
aws s3 sync dist/ "s3://$BUCKET" --delete "${EXCLUDES[@]}" \
  --cache-control "public,max-age=31536000,immutable"

# 2. Entry files last, never cached.
INVALIDATE=()
for f in "${NO_CACHE_FILES[@]}"; do
  if [ -f "dist/$f" ]; then
    aws s3 cp "dist/$f" "s3://$BUCKET/$f" --cache-control "no-cache"
    INVALIDATE+=("/$f")
  fi
done

echo "Clearing CloudFront's cached copies of: ${INVALIDATE[*]}"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "${INVALIDATE[@]}" > /dev/null

echo "Deployed: $SITE_URL"
