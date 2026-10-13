#!/usr/bin/env bash
# One-time setup: creates the VAPID key pair used to sign push notifications
# and stores it in SSM Parameter Store (the private key encrypted).
# Safe to re-run: it never replaces existing keys, because that would break
# every device that has already subscribed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/infra/envs/dev"

tf_out() {
  terraform -chdir="$TF_DIR" output -raw "$1"
}

PUBLIC_PARAM="$(tf_out vapid_public_param)"
PRIVATE_PARAM="$(tf_out vapid_private_param)"

if aws ssm get-parameter --name "$PRIVATE_PARAM" > /dev/null 2>&1; then
  echo "VAPID keys already exist ($PRIVATE_PARAM). Leaving them unchanged."
  exit 0
fi

echo "Generating a new VAPID key pair"
KEYS_JSON="$(npx --yes web-push generate-vapid-keys --json)"
PUBLIC_KEY="$(node -e 'console.log(JSON.parse(process.argv[1]).publicKey)' "$KEYS_JSON")"
PRIVATE_KEY="$(node -e 'console.log(JSON.parse(process.argv[1]).privateKey)' "$KEYS_JSON")"

aws ssm put-parameter --name "$PUBLIC_PARAM" --type String --value "$PUBLIC_KEY" > /dev/null
aws ssm put-parameter --name "$PRIVATE_PARAM" --type SecureString --value "$PRIVATE_KEY" > /dev/null

echo "Saved: $PUBLIC_PARAM (public) and $PRIVATE_PARAM (encrypted)"
